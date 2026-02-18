import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const warehouseId = sp.get('warehouseId')
    const itemId = sp.get('itemId')

    const where: any = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (itemId) where.itemId = itemId

    // 재고 + 수주잔량 + 총 건수 쿼리 병렬 실행
    const [balances, activeOrderDetails, totalCount] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        include: {
          item: { select: { id: true, itemCode: true, itemName: true, unit: true, itemType: true, category: { select: { name: true } } } },
          warehouse: { select: { id: true, code: true, name: true } },
          zone: { select: { zoneCode: true, zoneName: true } },
        },
        orderBy: [{ warehouse: { code: 'asc' } }, { item: { itemCode: 'asc' } }],
        skip,
        take: pageSize,
      }),
      prisma.salesOrderDetail.groupBy({
        by: ['itemId'],
        where: {
          salesOrder: {
            status: { in: ['ORDERED', 'IN_PROGRESS'] },
          },
          remainingQty: { gt: 0 },
        },
        _sum: { remainingQty: true },
      }),
      prisma.stockBalance.count({ where }),
    ])

    const orderedQtyMap = new Map<string, number>()
    for (const d of activeOrderDetails) {
      orderedQtyMap.set(d.itemId, Number(d._sum.remainingQty ?? 0))
    }

    const result = balances.map((b) => {
      const currentQty = Number(b.quantity)
      const orderedQty = orderedQtyMap.get(b.itemId) || 0
      const availableQty = Math.max(0, currentQty - orderedQty)
      return {
        ...b,
        orderedQty,
        availableQty,
      }
    })

    return successResponse(result, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
