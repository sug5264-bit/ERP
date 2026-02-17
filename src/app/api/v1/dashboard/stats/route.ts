import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // 모든 DB 쿼리를 병렬 실행 (순차 → 병렬로 ~3-5x 빠름)
    const [deptStats, departments, stockBalances, approvalDocs, leaveStats] =
      await Promise.all([
        prisma.employee.groupBy({
          by: ['departmentId'],
          where: { status: 'ACTIVE' },
          _count: { id: true },
        }),
        prisma.department.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        }),
        prisma.stockBalance.findMany({
          include: { item: { select: { itemName: true, unit: true } } },
          orderBy: { quantity: 'desc' },
          take: 10,
        }),
        prisma.approvalDocument.findMany({
          where: { createdAt: { gte: sixMonthsAgo } },
          select: { status: true, createdAt: true },
        }),
        prisma.leave.groupBy({
          by: ['leaveType'],
          where: { startDate: { gte: yearStart }, status: { in: ['APPROVED', 'REQUESTED'] } },
          _count: { id: true },
          _sum: { days: true },
        }),
      ])

    // 부서별 인원
    const deptData = deptStats.map((d) => ({
      name: departments.find((dept) => dept.id === d.departmentId)?.name || '미정',
      count: d._count.id,
    })).sort((a, b) => b.count - a.count)

    // 재고 현황 상위 10
    const stockData = stockBalances.map((sb) => ({
      name: sb.item?.itemName || '-',
      quantity: Number(sb.quantity),
      unit: sb.item?.unit || 'EA',
    }))

    // 월별 결재 처리 현황
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

    // 휴가 유형별 통계
    const leaveTypeMap: Record<string, string> = {
      ANNUAL: '연차', SICK: '병가', FAMILY: '경조사', MATERNITY: '출산', PARENTAL: '육아', OFFICIAL: '공가',
    }
    const leaveData = leaveStats.map((l) => ({
      type: leaveTypeMap[l.leaveType] || l.leaveType,
      count: l._count.id,
      days: Number(l._sum.days || 0),
    }))

    return successResponse({
      deptData,
      stockData,
      approvalData,
      leaveData,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
