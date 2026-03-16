import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter for aggregation
    const dateFilter: Record<string, unknown> = { shipperId }
    if (startDate && endDate) {
      dateFilter.orderDate = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      }
    } else if (startDate) {
      dateFilter.orderDate = { gte: new Date(startDate) }
    } else if (endDate) {
      dateFilter.orderDate = { lte: new Date(endDate + 'T23:59:59.999Z') }
    }

    // Aggregate shipping orders by month to produce settlement data
    const orders = await prisma.shipperOrder.findMany({
      where: dateFilter,
      select: {
        id: true,
        orderDate: true,
        shippingCost: true,
        status: true,
        deliveredAt: true,
      },
      orderBy: { orderDate: 'asc' },
    })

    // Group by month
    const monthMap = new Map<
      string,
      { totalOrders: number; totalShippingCost: number; statuses: string[]; lastPaidAt: Date | null }
    >()

    for (const order of orders) {
      const d = new Date(order.orderDate)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      const existing = monthMap.get(period) || {
        totalOrders: 0,
        totalShippingCost: 0,
        statuses: [],
        lastPaidAt: null,
      }

      existing.totalOrders += 1
      existing.totalShippingCost += Number(order.shippingCost || 0)
      existing.statuses.push(order.status)
      monthMap.set(period, existing)
    }

    // Check paid status from Note table
    const paidNotes = await prisma.note.findMany({
      where: { relatedTable: 'SettlementPaid' },
      select: { relatedId: true, createdAt: true },
    })
    const paidMap = new Map(paidNotes.map((n) => [n.relatedId, n]))

    const settlements = Array.from(monthMap.entries())
      .map(([period, data]) => {
        const allDelivered = data.statuses.every((s) => s === 'DELIVERED')
        const paidKey = `${shipperId}_${period}`
        const paidNote = paidMap.get(paidKey)
        const status = paidNote ? 'PAID' : allDelivered ? 'CONFIRMED' : 'PROCESSING'
        return {
          id: period,
          period,
          totalOrders: data.totalOrders,
          totalShippingCost: data.totalShippingCost,
          additionalCharges: 0,
          totalAmount: data.totalShippingCost,
          status,
          paidAt: paidNote?.createdAt ?? null,
        }
      })
      .sort((a, b) => b.period.localeCompare(a.period))

    return successResponse(settlements)
  } catch (error) {
    return handleApiError(error)
  }
}
