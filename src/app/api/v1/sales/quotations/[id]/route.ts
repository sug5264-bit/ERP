import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const quotation = await prisma.quotation.findUnique({
      where: { id }, include: { partner: true, employee: true, details: { include: { item: true }, orderBy: { lineNo: 'asc' } } },
    })
    if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(quotation)
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params
    const body = await request.json()
    if (body.action === 'submit') {
      const q = await prisma.quotation.update({ where: { id }, data: { status: 'SUBMITTED' } })
      return successResponse(q)
    }
    if (body.action === 'cancel') {
      const q = await prisma.quotation.update({ where: { id }, data: { status: 'CANCELLED' } })
      return successResponse(q)
    }
    if (body.action === 'convert') {
      const quotation = await prisma.quotation.findUnique({
        where: { id }, include: { details: { include: { item: { select: { id: true, taxType: true } } } } },
      })
      if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (quotation.status === 'ORDERED') return errorResponse('이미 발주 전환된 견적입니다.', 'ALREADY_ORDERED')
      if (quotation.status === 'CANCELLED') return errorResponse('취소된 견적은 전환할 수 없습니다.', 'INVALID_STATUS')

      const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
      if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

      const orderNo = await generateDocumentNumber('SO', new Date())
      const details = quotation.details.map((d, idx) => {
        const supplyAmount = Number(d.supplyAmount)
        const taxType = d.item?.taxType || 'TAXABLE'
        const taxAmount = taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
        return {
          lineNo: idx + 1, itemId: d.itemId,
          quantity: Number(d.quantity), unitPrice: Number(d.unitPrice),
          supplyAmount, taxAmount, totalAmount: supplyAmount + taxAmount,
          deliveredQty: 0, remainingQty: Number(d.quantity),
        }
      })
      const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
      const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.salesOrder.create({
          data: {
            orderNo, orderDate: new Date(), partnerId: quotation.partnerId,
            quotationId: id, employeeId: employee.id,
            totalSupply, totalTax, totalAmount: totalSupply + totalTax,
            description: quotation.description,
            details: { create: details },
          },
          include: { partner: true },
        })
        await tx.quotation.update({ where: { id }, data: { status: 'ORDERED' } })
        return order
      })
      return successResponse(result)
    }
    // 견적 수정
    if (body.action === 'update' || (!body.action && body.quotationDate)) {
      const quotation = await prisma.quotation.findUnique({ where: { id }, include: { details: true } })
      if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (quotation.status === 'ORDERED') return errorResponse('발주 전환된 견적은 수정할 수 없습니다.', 'INVALID_STATUS')
      if (quotation.status === 'CANCELLED') return errorResponse('취소된 견적은 수정할 수 없습니다.', 'INVALID_STATUS')

      const updateData: any = {}
      if (body.quotationDate) updateData.quotationDate = new Date(body.quotationDate)
      if (body.partnerId) updateData.partnerId = body.partnerId
      if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null
      if (body.description !== undefined) updateData.description = body.description || null

      if (body.details && Array.isArray(body.details)) {
        const itemIds = body.details.map((d: any) => d.itemId)
        const itemsInfo = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, taxType: true } })
        const taxTypeMap = new Map(itemsInfo.map((i: any) => [i.id, i.taxType]))

        const details = body.details.map((d: any, idx: number) => {
          const supplyAmount = d.quantity * d.unitPrice
          const taxType = taxTypeMap.get(d.itemId) || 'TAXABLE'
          const taxAmount = taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
          return { lineNo: idx + 1, itemId: d.itemId, quantity: d.quantity, unitPrice: d.unitPrice, supplyAmount, taxAmount, totalAmount: supplyAmount + taxAmount, remark: d.remark || null }
        })
        const totalSupply = details.reduce((s: number, d: any) => s + d.supplyAmount, 0)
        const totalTax = details.reduce((s: number, d: any) => s + d.taxAmount, 0)
        updateData.totalSupply = totalSupply
        updateData.totalTax = totalTax
        updateData.totalAmount = totalSupply + totalTax

        await prisma.$transaction(async (tx) => {
          await tx.quotationDetail.deleteMany({ where: { quotationId: id } })
          await tx.quotationDetail.createMany({ data: details.map((d: any) => ({ ...d, quotationId: id })) })
          await tx.quotation.update({ where: { id }, data: updateData })
        })
      } else {
        await prisma.quotation.update({ where: { id }, data: updateData })
      }

      const updated = await prisma.quotation.findUnique({
        where: { id }, include: { partner: true, details: { include: { item: true } } }
      })
      return successResponse(updated)
    }
    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION')
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params

    const quotation = await prisma.quotation.findUnique({ where: { id } })
    if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    await prisma.$transaction(async (tx) => {
      const salesOrders = await tx.salesOrder.findMany({ where: { quotationId: id }, select: { id: true } })
      if (salesOrders.length > 0) {
        const orderIds = salesOrders.map(o => o.id)
        const deliveries = await tx.delivery.findMany({ where: { salesOrderId: { in: orderIds } }, select: { id: true } })
        if (deliveries.length > 0) {
          await tx.deliveryDetail.deleteMany({ where: { deliveryId: { in: deliveries.map(d => d.id) } } })
          await tx.delivery.deleteMany({ where: { salesOrderId: { in: orderIds } } })
        }
        await tx.salesOrderDetail.deleteMany({ where: { salesOrderId: { in: orderIds } } })
        await tx.salesOrder.deleteMany({ where: { quotationId: id } })
      }
      await tx.quotationDetail.deleteMany({ where: { quotationId: id } })
      await tx.quotation.delete({ where: { id } })
    })

    return successResponse({ message: '견적이 삭제되었습니다.' })
  } catch (error) { return handleApiError(error) }
}
