import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createSalesOrderSchema } from '@/lib/validations/sales'
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
    const salesChannel = sp.get('salesChannel')
    if (salesChannel) where.salesChannel = salesChannel
    const [items, totalCount] = await Promise.all([
      prisma.salesOrder.findMany({
        where, include: { partner: true, employee: true, quotation: true, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.salesOrder.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createSalesOrderSchema.parse(body)
    const orderNo = await generateDocumentNumber('SO', new Date(data.orderDate))
    const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // Stock level check for each order item
    const warnings: string[] = []
    for (const d of data.details) {
      const stockAgg = await prisma.stockBalance.aggregate({
        where: { itemId: d.itemId },
        _sum: { quantity: true },
      })
      const availableQty = Number(stockAgg._sum.quantity ?? 0)
      if (d.quantity > availableQty) {
        const item = await prisma.item.findUnique({ where: { id: d.itemId }, select: { itemName: true } })
        const itemName = item?.itemName ?? d.itemId
        warnings.push(`품목 ${itemName}: 주문수량 ${d.quantity}개, 가용재고 ${availableQty}개 (재고 부족)`)
      }
    }

    // Fetch item tax types for tax calculation
    const itemIds = data.details.map(d => d.itemId)
    const itemsForTax = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, taxType: true },
    })
    const itemTaxMap = new Map(itemsForTax.map(i => [i.id, i.taxType]))

    const details = data.details.map((d, idx) => {
      const supplyAmount = d.quantity * d.unitPrice
      const taxType = itemTaxMap.get(d.itemId) || 'TAXABLE'
      const taxAmount = taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
      return { lineNo: idx + 1, itemId: d.itemId, quantity: d.quantity, unitPrice: d.unitPrice, supplyAmount, taxAmount, totalAmount: supplyAmount + taxAmount, deliveredQty: 0, remainingQty: d.quantity, remark: d.remark || null }
    })
    const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
    const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.create({
        data: {
          orderNo, orderDate: new Date(data.orderDate), partnerId: data.partnerId,
          quotationId: data.quotationId || null,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          salesChannel: data.salesChannel || 'OFFLINE',
          totalSupply, totalTax, totalAmount: totalSupply + totalTax,
          employeeId: employee.id, description: data.description || null,
          details: { create: details },
        },
        include: { partner: true, details: { include: { item: true } } },
      })
      if (data.quotationId) {
        await tx.quotation.update({ where: { id: data.quotationId }, data: { status: 'ORDERED' } })
      }
      return order
    })
    return successResponse({ ...result, warnings })
  } catch (error) { return handleApiError(error) }
}
