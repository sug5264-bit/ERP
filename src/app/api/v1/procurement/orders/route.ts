import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createPurchaseOrderSchema } from '@/lib/validations/procurement'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = {}
    const status = sp.get('status')
    if (status) where.status = status
    const [items, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where, include: { partner: true, employee: true, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createPurchaseOrderSchema.parse(body)
    const orderNo = await generateDocumentNumber('PO', new Date(data.orderDate))
    const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const details = data.details.map((d, idx) => {
      const supplyAmount = d.quantity * d.unitPrice
      const taxAmount = Math.round(supplyAmount * 0.1)
      return { lineNo: idx + 1, itemId: d.itemId, quantity: d.quantity, unitPrice: d.unitPrice, supplyAmount, taxAmount, amount: supplyAmount + taxAmount, receivedQty: 0, remainingQty: d.quantity, remark: d.remark || null }
    })
    const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
    const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          orderNo, orderDate: new Date(data.orderDate), partnerId: data.partnerId,
          purchaseRequestId: data.purchaseRequestId || null,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          totalSupply, totalTax, totalAmount: totalSupply + totalTax,
          employeeId: employee.id, description: data.description || null,
          details: { create: details },
        },
        include: { partner: true, details: { include: { item: true } } },
      })
      if (data.purchaseRequestId) {
        await tx.purchaseRequest.update({ where: { id: data.purchaseRequestId }, data: { status: 'ORDERED' } })
      }
      return order
    })
    return successResponse(result)
  } catch (error) { return handleApiError(error) }
}
