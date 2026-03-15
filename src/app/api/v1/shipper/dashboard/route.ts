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

    // Monthly range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999)

    // Weekly range (last 7 days)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - 6)

    const [
      todayCount,
      processingCount,
      inTransitCount,
      deliveredCount,
      recentOrders,
      monthlyTotalOrders,
      monthlyDeliveredCount,
      monthlyDeliveredOrders,
      weeklyOrders,
    ] = await Promise.all([
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
      // Monthly total orders
      prisma.shipperOrder.count({
        where: { shipperId, createdAt: { gte: monthStart, lte: monthEnd } },
      }),
      // Monthly delivered count
      prisma.shipperOrder.count({
        where: { shipperId, status: 'DELIVERED', createdAt: { gte: monthStart, lte: monthEnd } },
      }),
      // Monthly delivered orders with timestamps for avg delivery days
      prisma.shipperOrder.findMany({
        where: {
          shipperId,
          status: 'DELIVERED',
          deliveredAt: { not: null },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: { createdAt: true, deliveredAt: true },
      }),
      // Weekly orders for chart (last 7 days)
      prisma.shipperOrder.findMany({
        where: { shipperId, createdAt: { gte: weekStart, lt: tomorrow } },
        select: { createdAt: true },
      }),
    ])

    // Build weekly data for chart
    const weeklyData: Array<{ date: string; count: number }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      const count = weeklyOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime()
        return t >= dayStart.getTime() && t <= dayEnd.getTime()
      }).length
      weeklyData.push({ date: dateStr, count })
    }

    // Calculate average delivery days
    let avgDeliveryDays = 0
    if (monthlyDeliveredOrders.length > 0) {
      const totalDays = monthlyDeliveredOrders.reduce((sum, o) => {
        const created = new Date(o.createdAt).getTime()
        const delivered = new Date(o.deliveredAt!).getTime()
        return sum + (delivered - created) / (1000 * 60 * 60 * 24)
      }, 0)
      avgDeliveryDays = Math.round((totalDays / monthlyDeliveredOrders.length) * 10) / 10
    }

    const deliveryRate =
      monthlyTotalOrders > 0 ? Math.round((monthlyDeliveredCount / monthlyTotalOrders) * 1000) / 10 : 0

    return successResponse({
      stats: { todayCount, processingCount, inTransitCount, deliveredCount },
      recentOrders,
      weeklyData,
      monthlyStats: {
        totalOrders: monthlyTotalOrders,
        deliveredCount: monthlyDeliveredCount,
        deliveryRate,
        avgDeliveryDays,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
