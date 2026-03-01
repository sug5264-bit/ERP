import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const warehouseId = sp.get('warehouseId')
    const itemId = sp.get('itemId')

    const where: Record<string, unknown> = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (itemId) where.itemId = itemId

    // 재고 + 수주잔량 + 총 건수 쿼리 병렬 실행
    const [balances, activeOrderDetails, totalCount] = await Promise.all([
      prisma.stockBalance.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              itemCode: true,
              itemName: true,
              unit: true,
              itemType: true,
              storageTemp: true,
              shelfLifeDays: true,
              manufacturer: true,
              category: { select: { name: true } },
            },
          },
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

    // 품목별 전체 재고 합계 (수주잔량은 품목 단위이므로 비율로 분배)
    const itemTotalStockMap = new Map<string, number>()
    for (const b of balances) {
      itemTotalStockMap.set(b.itemId, (itemTotalStockMap.get(b.itemId) || 0) + Number(b.quantity))
    }

    const result = balances.map((b) => {
      const currentQty = Number(b.quantity)
      const orderedQty = orderedQtyMap.get(b.itemId) || 0
      const totalStock = itemTotalStockMap.get(b.itemId) || 0
      // 가용재고를 창고 비율로 분배 (이중차감 방지)
      const totalAvailable = Math.max(0, totalStock - orderedQty)
      const ratio = totalStock > 0 ? currentQty / totalStock : 0
      const availableQty = Math.round(totalAvailable * ratio)
      return {
        ...b,
        orderedQty: totalStock > 0 ? Math.round(orderedQty * ratio) : 0,
        availableQty,
      }
    })

    return successResponse(result, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
