import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { partner: true, employee: true, details: { include: { item: true }, orderBy: { lineNo: 'asc' } } },
    })
    if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(quotation)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    if (body.action === 'submit') {
      const existing = await prisma.quotation.findUnique({ where: { id }, select: { status: true } })
      if (!existing) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (existing.status !== 'DRAFT') {
        return errorResponse('작성 상태의 견적만 제출할 수 있습니다.', 'INVALID_STATUS', 400)
      }
      const q = await prisma.quotation.update({ where: { id }, data: { status: 'SUBMITTED' } })
      return successResponse(q)
    }
    if (body.action === 'cancel') {
      const existing = await prisma.quotation.findUnique({ where: { id }, select: { status: true } })
      if (!existing) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (existing.status === 'ORDERED') {
        return errorResponse('발주 전환된 견적은 취소할 수 없습니다.', 'INVALID_STATUS', 400)
      }
      const q = await prisma.quotation.update({ where: { id }, data: { status: 'CANCELLED' } })
      return successResponse(q)
    }
    if (body.action === 'convert') {
      const quotation = await prisma.quotation.findUnique({
        where: { id },
        include: { details: { include: { item: { select: { id: true, taxType: true } } } } },
      })
      if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (quotation.status === 'ORDERED') return errorResponse('이미 발주 전환된 견적입니다.', 'ALREADY_ORDERED')
      if (quotation.status === 'CANCELLED') return errorResponse('취소된 견적은 전환할 수 없습니다.', 'INVALID_STATUS')

      const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
      if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

      const details = quotation.details.map((d, idx) => {
        const supplyAmount = Number(d.supplyAmount)
        const taxType = d.item?.taxType || 'TAXABLE'
        const taxAmount = taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
        return {
          lineNo: idx + 1,
          itemId: d.itemId,
          quantity: Number(d.quantity),
          unitPrice: Number(d.unitPrice),
          supplyAmount,
          taxAmount,
          totalAmount: supplyAmount + taxAmount,
          deliveredQty: 0,
          remainingQty: Number(d.quantity),
        }
      })
      const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
      const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

      const result = await prisma.$transaction(async (tx) => {
        const orderNo = await generateDocumentNumber('SO', new Date(), tx)
        const order = await tx.salesOrder.create({
          data: {
            orderNo,
            orderDate: new Date(),
            partnerId: quotation.partnerId,
            quotationId: id,
            employeeId: employee.id,
            totalSupply,
            totalTax,
            totalAmount: totalSupply + totalTax,
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
      if (quotation.status === 'ORDERED')
        return errorResponse('발주 전환된 견적은 수정할 수 없습니다.', 'INVALID_STATUS')
      if (quotation.status === 'CANCELLED') return errorResponse('취소된 견적은 수정할 수 없습니다.', 'INVALID_STATUS')

      const updateData: any = {}
      if (body.quotationDate) updateData.quotationDate = new Date(body.quotationDate)
      if (body.partnerId) updateData.partnerId = body.partnerId
      if (body.validUntil !== undefined) updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null
      if (body.description !== undefined) updateData.description = body.description || null

      if (body.details && Array.isArray(body.details)) {
        // 상세 항목 기본 검증
        for (const d of body.details) {
          if (!d.itemId || typeof d.itemId !== 'string') throw new Error('품목 ID가 올바르지 않습니다.')
          if (typeof d.quantity !== 'number' || d.quantity <= 0) throw new Error('수량은 0보다 커야 합니다.')
          if (typeof d.unitPrice !== 'number' || d.unitPrice < 0) throw new Error('단가는 0 이상이어야 합니다.')
        }

        const itemIds = body.details.map((d: any) => d.itemId)
        const itemsInfo = await prisma.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, taxType: true },
        })
        const taxTypeMap = new Map(itemsInfo.map((i: any) => [i.id, i.taxType]))

        const details = body.details.map((d: any, idx: number) => {
          const supplyAmount = Math.round(d.quantity * d.unitPrice)
          const taxType = taxTypeMap.get(d.itemId) || 'TAXABLE'
          const taxAmount = taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
          return {
            lineNo: idx + 1,
            itemId: d.itemId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            supplyAmount,
            taxAmount,
            totalAmount: supplyAmount + taxAmount,
            remark: d.remark || null,
          }
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
        where: { id },
        include: { partner: true, details: { include: { item: true } } },
      })
      return successResponse(updated)
    }
    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'delete')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params

    const quotation = await prisma.quotation.findUnique({ where: { id } })
    if (!quotation) return errorResponse('견적을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (quotation.status === 'ORDERED') {
      return errorResponse('발주 전환된 견적은 삭제할 수 없습니다. 먼저 발주를 삭제하세요.', 'HAS_ORDERS', 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.quotationDetail.deleteMany({ where: { quotationId: id } })
      await tx.quotation.delete({ where: { id } })
    })

    return successResponse({ message: '견적이 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
