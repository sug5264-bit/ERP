import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const sp = request.nextUrl.searchParams
    const year = parseInt(sp.get('year') || String(new Date().getFullYear()))
    const month = sp.get('month') ? parseInt(sp.get('month')!) : null

    const startDate = month
      ? new Date(year, month - 1, 1)
      : new Date(year, 0, 1)
    const endDate = month
      ? new Date(year, month, 1)
      : new Date(year + 1, 0, 1)

    const where = {
      orderDate: { gte: startDate, lt: endDate },
      status: { not: 'CANCELLED' as const },
    }

    // 모든 독립 쿼리를 병렬 실행
    const [onlineOrders, offlineOrders, monthlyAggs, topItemAggs] = await Promise.all([
      // Channel summary
      prisma.salesOrder.aggregate({
        where: { ...where, salesChannel: 'ONLINE' },
        _count: true,
        _sum: { totalAmount: true, totalSupply: true, totalTax: true },
      }),
      prisma.salesOrder.aggregate({
        where: { ...where, salesChannel: 'OFFLINE' },
        _count: true,
        _sum: { totalAmount: true, totalSupply: true, totalTax: true },
      }),
      // Monthly breakdown: DB-level aggregation (unbounded row fetch 제거)
      prisma.$queryRaw<{ month: string; channel: string; total: number }[]>`
        SELECT to_char("orderDate", 'YYYY-MM') as month,
               "salesChannel" as channel,
               SUM("totalAmount")::float as total
        FROM sales_orders
        WHERE "orderDate" >= ${startDate} AND "orderDate" < ${endDate}
          AND status != 'CANCELLED'
        GROUP BY to_char("orderDate", 'YYYY-MM'), "salesChannel"
        ORDER BY month
      `,
      // Top items: DB에서 집계 (unbounded findMany 제거)
      prisma.salesOrderDetail.groupBy({
        by: ['itemId'],
        where: { salesOrder: { ...where } },
        _sum: { totalAmount: true, quantity: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
    ])

    // Monthly breakdown 처리 (이미 DB에서 집계된 결과)
    const monthlyMap = new Map<string, { online: number; offline: number; total: number }>()
    for (const row of monthlyAggs) {
      if (!monthlyMap.has(row.month)) monthlyMap.set(row.month, { online: 0, offline: 0, total: 0 })
      const entry = monthlyMap.get(row.month)!
      const amount = Number(row.total)
      if (row.channel === 'ONLINE') entry.online += amount
      else entry.offline += amount
      entry.total += amount
    }

    const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    }))

    // Top items: 상위 10개만 추가 조회 (채널별 분류)
    const topItemIds = topItemAggs.map(a => a.itemId)
    const [itemInfos, onlineItemAggs] = await Promise.all([
      prisma.item.findMany({
        where: { id: { in: topItemIds } },
        select: { id: true, itemCode: true, itemName: true },
      }),
      prisma.salesOrderDetail.groupBy({
        by: ['itemId'],
        where: {
          itemId: { in: topItemIds },
          salesOrder: { ...where, salesChannel: 'ONLINE' },
        },
        _sum: { totalAmount: true },
      }),
    ])

    const itemInfoMap = new Map(itemInfos.map(i => [i.id, i]))
    const onlineMap = new Map(onlineItemAggs.map(a => [a.itemId, Number(a._sum.totalAmount || 0)]))

    const topItems = topItemAggs.map(agg => {
      const item = itemInfoMap.get(agg.itemId)
      const total = Number(agg._sum.totalAmount || 0)
      const online = onlineMap.get(agg.itemId) || 0
      return {
        itemCode: item?.itemCode || '',
        itemName: item?.itemName || '',
        online,
        offline: total - online,
        total,
        qty: Number(agg._sum.quantity || 0),
      }
    })

    return successResponse({
      period: { year, month },
      online: {
        count: onlineOrders._count,
        totalAmount: Number(onlineOrders._sum.totalAmount || 0),
        totalSupply: Number(onlineOrders._sum.totalSupply || 0),
        totalTax: Number(onlineOrders._sum.totalTax || 0),
      },
      offline: {
        count: offlineOrders._count,
        totalAmount: Number(offlineOrders._sum.totalAmount || 0),
        totalSupply: Number(offlineOrders._sum.totalSupply || 0),
        totalTax: Number(offlineOrders._sum.totalTax || 0),
      },
      total: {
        count: onlineOrders._count + offlineOrders._count,
        totalAmount: Number(onlineOrders._sum.totalAmount || 0) + Number(offlineOrders._sum.totalAmount || 0),
      },
      monthly,
      topItems,
    }, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}
