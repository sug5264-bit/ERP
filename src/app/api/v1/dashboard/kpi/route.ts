import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

// GET: 대시보드 KPI 카운트를 단일 요청으로 통합 (5개 개별 쿼리 → 1개 요청)
export async function GET() {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const employee = await prisma.employee.findFirst({
      where: { user: { id: authResult.session.user.id } },
      select: { id: true },
    })

    const [empCount, itemCount, approvalCount, leaveCount] = await Promise.all([
      prisma.employee.count({ where: { status: 'ACTIVE' } }),
      prisma.item.count({ where: { isActive: true } }),
      employee
        ? prisma.approvalDocument.count({
            where: {
              status: 'IN_PROGRESS',
              steps: {
                some: { approverId: employee.id, status: 'PENDING' },
              },
            },
          })
        : Promise.resolve(0),
      prisma.leave.count({ where: { status: 'REQUESTED' } }),
    ])

    // 안전재고 이하 품목 수 (raw query 사용하여 join 처리)
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

    return successResponse({ empCount, itemCount, approvalCount, stockAlertCount, leaveCount }, undefined, {
      cache: 's-maxage=60, stale-while-revalidate=120',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
