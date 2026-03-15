import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams

    const where: Record<string, unknown> = {
      status: 'DELIVERED',
    }

    const shipperId = sp.get('shipperId')
    if (shipperId) where.shipperId = shipperId

    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      const dateRange: { gte?: Date; lte?: Date } = {}
      if (startDate) {
        const d = new Date(startDate)
        if (!isNaN(d.getTime())) dateRange.gte = d
      }
      if (endDate) {
        const d = new Date(endDate)
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999)
          dateRange.lte = d
        }
      }
      where.deliveredAt = dateRange
    }

    const groupBy = sp.get('groupBy') || 'daily' // 'daily' or 'monthly'

    const orders = await prisma.shipperOrder.findMany({
      where,
      select: {
        deliveredAt: true,
        orderDate: true,
        shippingCost: true,
        surcharge: true,
      },
      orderBy: { deliveredAt: 'asc' },
    })

    // Group by date
    const revenueMap = new Map<
      string,
      {
        date: string
        totalOrders: number
        totalRevenue: number
      }
    >()

    for (const order of orders) {
      const deliveredDate = order.deliveredAt || order.orderDate
      let dateKey: string

      if (groupBy === 'monthly') {
        dateKey = `${deliveredDate.getFullYear()}-${String(deliveredDate.getMonth() + 1).padStart(2, '0')}`
      } else {
        dateKey = deliveredDate.toISOString().split('T')[0]
      }

      const revenue = Number(order.shippingCost || 0) + Number(order.surcharge || 0)
      const existing = revenueMap.get(dateKey)

      if (existing) {
        existing.totalOrders += 1
        existing.totalRevenue += revenue
      } else {
        revenueMap.set(dateKey, {
          date: dateKey,
          totalOrders: 1,
          totalRevenue: revenue,
        })
      }
    }

    const data = Array.from(revenueMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        averagePerOrder: item.totalOrders > 0 ? Math.round(item.totalRevenue / item.totalOrders) : 0,
      }))

    const totalOrders = data.reduce((sum, d) => sum + d.totalOrders, 0)
    const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0)

    return successResponse({
      summary: {
        totalOrders,
        totalRevenue,
        averagePerOrder: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      },
      details: data,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
