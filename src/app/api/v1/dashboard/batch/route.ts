import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

// GET: 대시보드 전체 데이터를 단일 요청으로 통합 (5개 HTTP 요청 → 1개)
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const employee = await prisma.employee.findFirst({
      where: { user: { id: session.user!.id! } },
      select: { id: true },
    })

    // 모든 대시보드 데이터를 병렬 조회
    const [
      empCount, itemCount, approvalCount, leaveCount,
      recentOrders, notices,
      deptStats, departments, stockBalances, approvalDocs, leaveStats,
      onlineOrders, offlineOrders, monthlyOrders,
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
          id: true, orderNo: true, totalAmount: true,
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
        include: { item: { select: { itemName: true, unit: true } } },
        orderBy: { quantity: 'desc' },
        take: 10,
      }),
      // Stats: 결재 현황
      prisma.approvalDocument.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { status: true, createdAt: true },
      }),
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
      prisma.salesOrder.findMany({
        where: { orderDate: { gte: yearStart }, status: { not: 'CANCELLED' } },
        select: { orderDate: true, salesChannel: true, totalAmount: true },
        orderBy: { orderDate: 'asc' },
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
    } catch {
      stockAlertCount = 0
    }

    // Stats 가공
    const deptData = deptStats.map((d) => ({
      name: departments.find((dept) => dept.id === d.departmentId)?.name || '미정',
      count: d._count.id,
    })).sort((a, b) => b.count - a.count)

    const stockData = stockBalances.map((sb) => ({
      name: sb.item?.itemName || '-',
      quantity: Number(sb.quantity),
      unit: sb.item?.unit || 'EA',
    }))

    const approvalByMonth: Record<string, { approved: number; rejected: number; pending: number }> = {}
    approvalDocs.forEach((doc) => {
      const month = doc.createdAt.toISOString().slice(0, 7)
      if (!approvalByMonth[month]) approvalByMonth[month] = { approved: 0, rejected: 0, pending: 0 }
      if (doc.status === 'APPROVED') approvalByMonth[month].approved++
      else if (doc.status === 'REJECTED') approvalByMonth[month].rejected++
      else approvalByMonth[month].pending++
    })
    const approvalData = Object.entries(approvalByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))

    const leaveTypeMap: Record<string, string> = {
      ANNUAL: '연차', SICK: '병가', FAMILY: '경조사', MATERNITY: '출산', PARENTAL: '육아', OFFICIAL: '공가',
    }
    const leaveData = leaveStats.map((l) => ({
      type: leaveTypeMap[l.leaveType] || l.leaveType,
      count: l._count.id,
      days: Number(l._sum.days || 0),
    }))

    // Sales monthly
    const monthlyMap = new Map<string, { online: number; offline: number; total: number }>()
    for (const order of monthlyOrders) {
      const key = `${order.orderDate.getFullYear()}-${String(order.orderDate.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap.has(key)) monthlyMap.set(key, { online: 0, offline: 0, total: 0 })
      const entry = monthlyMap.get(key)!
      const amount = Number(order.totalAmount)
      if (order.salesChannel === 'ONLINE') entry.online += amount
      else entry.offline += amount
      entry.total += amount
    }
    const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({ month, ...data }))

    return successResponse({
      kpi: { empCount, itemCount, approvalCount, stockAlertCount, leaveCount },
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
    }, undefined, { cache: 's-maxage=60, stale-while-revalidate=120' })
  } catch (error) {
    return handleApiError(error)
  }
}
