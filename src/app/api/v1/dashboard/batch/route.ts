import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'

// GET: 대시보드 전체 데이터를 단일 요청으로 통합 (5개 HTTP 요청 → 1개)
export async function GET() {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setDate(1) // 날짜 오버플로 방지
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    // 이번 달 / 지난 달 기간 계산 (트렌드용)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const employee = await prisma.employee.findFirst({
      where: { user: { id: authResult.session.user.id } },
      select: { id: true },
    })

    // 모든 대시보드 데이터를 병렬 조회
    const [
      empCount,
      itemCount,
      approvalCount,
      leaveCount,
      recentOrders,
      notices,
      deptStats,
      departments,
      stockBalances,
      approvalAggs,
      leaveStats,
      onlineOrders,
      offlineOrders,
      monthlyAggs,
      thisMonthSales,
      lastMonthSales,
      thisMonthNewEmp,
      lastMonthNewEmp,
      todayOrderCount,
    ] = await Promise.all([
      // KPI
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.item.count({ where: { isActive: true } }),
      employee
        ? prisma.approvalDocument.count({
            where: { status: 'IN_PROGRESS', steps: { some: { approverId: employee.id, status: 'PENDING' } } },
          })
        : Promise.resolve(0),
      prisma.leave.count({ where: { status: 'REQUESTED' } }),
      // Recent orders (5건)
      prisma.salesOrder.findMany({
        select: {
          id: true,
          orderNo: true,
          totalAmount: true,
          partner: { select: { partnerName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Notices (5건)
      prisma.post.findMany({
        where: {
          isActive: true,
          board: { boardCode: 'NOTICE' },
        },
        select: { id: true, title: true, isPinned: true, createdAt: true },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      // Stats: 부서별 인원
      prisma.employee.groupBy({
        by: ['departmentId'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
      // Stats: 재고 상위 10
      prisma.stockBalance.findMany({
        select: {
          itemId: true,
          quantity: true,
          item: { select: { itemName: true, unit: true } },
        },
        orderBy: { quantity: 'desc' },
        take: 10,
      }),
      // Stats: 결재 현황 (DB-level aggregation, 개별 row fetch 제거)
      prisma.$queryRaw<{ month: string; status: string; count: bigint }[]>`
        SELECT to_char("createdAt", 'YYYY-MM') as month, status, COUNT(*)::bigint as count
        FROM approval_documents
        WHERE "createdAt" >= ${sixMonthsAgo}
        GROUP BY to_char("createdAt", 'YYYY-MM'), status
        ORDER BY month
      `,
      // Stats: 휴가 통계
      prisma.leave.groupBy({
        by: ['leaveType'],
        where: { startDate: { gte: yearStart }, status: { in: ['APPROVED', 'REQUESTED'] } },
        _count: { id: true },
        _sum: { days: true },
      }),
      // Sales summary
      prisma.salesOrder.aggregate({
        where: { orderDate: { gte: yearStart }, status: { not: 'CANCELLED' }, salesChannel: 'ONLINE' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      prisma.salesOrder.aggregate({
        where: { orderDate: { gte: yearStart }, status: { not: 'CANCELLED' }, salesChannel: 'OFFLINE' },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // 월별 매출 DB-level aggregation (최대 50,000 row fetch → 최대 24 row)
      prisma.$queryRaw<{ month: string; channel: string; total: number }[]>`
        SELECT to_char("orderDate", 'YYYY-MM') as month,
               "salesChannel" as channel,
               SUM("totalAmount")::float as total
        FROM sales_orders
        WHERE "orderDate" >= ${yearStart} AND status != 'CANCELLED'
        GROUP BY to_char("orderDate", 'YYYY-MM'), "salesChannel"
        ORDER BY month
      `,
      // 트렌드: 이번 달 매출
      prisma.salesOrder.aggregate({
        where: { orderDate: { gte: thisMonthStart }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // 트렌드: 지난 달 매출
      prisma.salesOrder.aggregate({
        where: { orderDate: { gte: lastMonthStart, lte: lastMonthEnd }, status: { not: 'CANCELLED' } },
        _count: true,
        _sum: { totalAmount: true },
      }),
      // 트렌드: 이번 달 신규 사원
      prisma.employee.count({ where: { joinDate: { gte: thisMonthStart }, status: 'ACTIVE' } }),
      // 트렌드: 지난 달 신규 사원
      prisma.employee.count({ where: { joinDate: { gte: lastMonthStart, lte: lastMonthEnd }, status: 'ACTIVE' } }),
      // 오늘 발주 건수
      prisma.salesOrder.count({
        where: {
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          status: { not: 'CANCELLED' },
        },
      }),
    ])

    // 안전재고 이하 품목 수
    let stockAlertCount = 0
    try {
      const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT sb."itemId")::bigint as count
        FROM stock_balances sb
        JOIN items i ON sb."itemId" = i.id
        WHERE sb.quantity <= i."safetyStock" AND i."safetyStock" > 0
      `
      stockAlertCount = Number(result[0]?.count ?? 0)
    } catch (err) {
      logger.warn('Stock alert count query failed', { error: err instanceof Error ? err.message : String(err) })
      stockAlertCount = 0
    }

    // Stats 가공
    const deptData = deptStats
      .map((d) => ({
        name: departments.find((dept) => dept.id === d.departmentId)?.name || '미정',
        count: d._count.id,
      }))
      .sort((a, b) => b.count - a.count)

    const stockData = stockBalances.map((sb) => ({
      name: sb.item?.itemName || '-',
      quantity: Number(sb.quantity),
      unit: sb.item?.unit || 'EA',
    }))

    const approvalByMonth: Record<string, { approved: number; rejected: number; pending: number }> = {}
    for (const row of approvalAggs) {
      if (!approvalByMonth[row.month]) approvalByMonth[row.month] = { approved: 0, rejected: 0, pending: 0 }
      const count = Number(row.count)
      if (row.status === 'APPROVED') approvalByMonth[row.month].approved += count
      else if (row.status === 'REJECTED') approvalByMonth[row.month].rejected += count
      else approvalByMonth[row.month].pending += count
    }
    const approvalData = Object.entries(approvalByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    const leaveTypeMap: Record<string, string> = {
      ANNUAL: '연차',
      SICK: '병가',
      FAMILY: '경조사',
      MATERNITY: '출산',
      PARENTAL: '육아',
      OFFICIAL: '공가',
    }
    const leaveData = leaveStats.map((l) => ({
      type: leaveTypeMap[l.leaveType] || l.leaveType,
      count: l._count.id,
      days: Number(l._sum.days || 0),
    }))

    // Sales monthly (이미 DB에서 집계된 결과 사용)
    const monthlyMap = new Map<string, { online: number; offline: number; total: number }>()
    for (const row of monthlyAggs) {
      if (!monthlyMap.has(row.month)) monthlyMap.set(row.month, { online: 0, offline: 0, total: 0 })
      const entry = monthlyMap.get(row.month)!
      const amount = Number(row.total)
      if (row.channel === 'ONLINE') entry.online += amount
      else entry.offline += amount
      entry.total += amount
    }
    const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data }))

    // 트렌드 계산
    const thisMonthAmount = Number(thisMonthSales._sum.totalAmount || 0)
    const lastMonthAmount = Number(lastMonthSales._sum.totalAmount || 0)
    const salesTrend =
      lastMonthAmount > 0
        ? Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100)
        : thisMonthAmount > 0
          ? 100
          : 0
    const orderTrend =
      lastMonthSales._count > 0
        ? Math.round(((thisMonthSales._count - lastMonthSales._count) / lastMonthSales._count) * 100)
        : thisMonthSales._count > 0
          ? 100
          : 0

    return successResponse(
      {
        kpi: { empCount, itemCount, approvalCount, stockAlertCount, leaveCount },
        trends: {
          salesAmount: { current: thisMonthAmount, previous: lastMonthAmount, change: salesTrend },
          orderCount: { current: thisMonthSales._count, previous: lastMonthSales._count, change: orderTrend },
          newEmployees: { current: thisMonthNewEmp, previous: lastMonthNewEmp },
          todayOrders: todayOrderCount,
        },
        recentOrders,
        notices,
        stats: { deptData, stockData, approvalData, leaveData },
        salesSummary: {
          period: { year: now.getFullYear() },
          online: { count: onlineOrders._count, totalAmount: Number(onlineOrders._sum.totalAmount || 0) },
          offline: { count: offlineOrders._count, totalAmount: Number(offlineOrders._sum.totalAmount || 0) },
          total: {
            count: onlineOrders._count + offlineOrders._count,
            totalAmount: Number(onlineOrders._sum.totalAmount || 0) + Number(offlineOrders._sum.totalAmount || 0),
          },
          monthly,
        },
      },
      undefined,
      { cache: 's-maxage=60, stale-while-revalidate=120' }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
