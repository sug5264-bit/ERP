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
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.orderDate = {}
      if (startDate) where.orderDate.gte = new Date(startDate)
      if (endDate) where.orderDate.lte = new Date(endDate)
    }
    // 거래처 필터
    const partnerId = sp.get('partnerId')
    if (partnerId) where.partnerId = partnerId
    // 금액 범위 필터
    const minAmount = sp.get('minAmount')
    const maxAmount = sp.get('maxAmount')
    if (minAmount || maxAmount) {
      where.totalAmount = {}
      if (minAmount) where.totalAmount.gte = Number(minAmount)
      if (maxAmount) where.totalAmount.lte = Number(maxAmount)
    }
    // 통합 검색 (발주번호 또는 거래처명)
    const search = sp.get('search')
    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: 'insensitive' } },
        { partner: { partnerName: { contains: search, mode: 'insensitive' } } },
      ]
    }
    const [items, totalCount] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          partner: { select: { id: true, partnerCode: true, partnerName: true, partnerType: true } },
          employee: { select: { id: true, nameKo: true } },
          quotation: { select: { id: true, quotationNo: true } },
          _count: { select: { details: true } },
        },
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

    // 가용재고 체크: 현재고 - 기존 미처리 수주잔량
    const warnings: string[] = []
    const orderItemIds = data.details.map(d => d.itemId)

    // 재고, 수주잔량, 품목정보를 병렬 조회
    const [stockAggs, orderedAggs, itemsInfo] = await Promise.all([
      prisma.stockBalance.groupBy({
        by: ['itemId'],
        where: { itemId: { in: orderItemIds } },
        _sum: { quantity: true },
      }),
      prisma.salesOrderDetail.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: orderItemIds },
          salesOrder: { status: { in: ['ORDERED', 'IN_PROGRESS'] } },
          remainingQty: { gt: 0 },
        },
        _sum: { remainingQty: true },
      }),
      prisma.item.findMany({
        where: { id: { in: orderItemIds } },
        select: { id: true, itemName: true, taxType: true },
      }),
    ])
    const stockMap = new Map(stockAggs.map(s => [s.itemId, Number(s._sum.quantity ?? 0)]))
    const orderedMap = new Map(orderedAggs.map(o => [o.itemId, Number(o._sum.remainingQty ?? 0)]))
    const itemInfoMap = new Map(itemsInfo.map(i => [i.id, i]))

    for (const d of data.details) {
      const currentStock = stockMap.get(d.itemId) || 0
      const existingOrdered = orderedMap.get(d.itemId) || 0
      const availableQty = Math.max(0, currentStock - existingOrdered)
      if (d.quantity > availableQty) {
        const itemName = itemInfoMap.get(d.itemId)?.itemName ?? d.itemId
        warnings.push(`품목 ${itemName}: 주문수량 ${d.quantity}개, 가용재고 ${availableQty}개 (재고 부족)`)
      }
    }

    const details = data.details.map((d, idx) => {
      const supplyAmount = Math.round(d.quantity * d.unitPrice)
      const taxType = itemInfoMap.get(d.itemId)?.taxType || 'TAXABLE'
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
          vatIncluded: data.vatIncluded ?? true,
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
