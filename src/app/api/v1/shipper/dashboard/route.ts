import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(_request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipperId: true, accountType: true },
    })

    if (!user?.shipperId || user.accountType !== 'SHIPPER') {
      return errorResponse('화주사 계정이 아닙니다.', 'FORBIDDEN', 403)
    }

    const shipperId = user.shipperId

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [todayCount, processingCount, inTransitCount, deliveredCount, recentOrders] = await Promise.all([
      prisma.shipperOrder.count({
        where: { shipperId, createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.shipperOrder.count({
        where: { shipperId, status: { in: ['RECEIVED', 'PROCESSING'] } },
      }),
      prisma.shipperOrder.count({
        where: { shipperId, status: { in: ['SHIPPED', 'IN_TRANSIT'] } },
      }),
      prisma.shipperOrder.count({
        where: { shipperId, status: 'DELIVERED' },
      }),
      prisma.shipperOrder.findMany({
        where: { shipperId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNo: true,
          recipientName: true,
          itemName: true,
          status: true,
          createdAt: true,
          trackingNo: true,
        },
      }),
    ])

    return successResponse({
      stats: { todayCount, processingCount, inTransitCount, deliveredCount },
      recentOrders,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
