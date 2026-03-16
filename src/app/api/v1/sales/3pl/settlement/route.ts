import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

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

    // Get all delivered orders matching filters
    const orders = await prisma.shipperOrder.findMany({
      where,
      include: {
        shipper: {
          select: { id: true, companyCode: true, companyName: true },
        },
      },
      orderBy: { deliveredAt: 'asc' },
    })

    // Group by shipperId + month
    const summaryMap = new Map<
      string,
      {
        shipperId: string
        companyCode: string
        companyName: string
        month: string
        totalOrders: number
        totalShippingCost: number
        totalSurcharge: number
        totalAmount: number
      }
    >()

    for (const order of orders) {
      const deliveredDate = order.deliveredAt || order.orderDate
      const month = `${deliveredDate.getFullYear()}-${String(deliveredDate.getMonth() + 1).padStart(2, '0')}`
      const key = `${order.shipperId}_${month}`

      const existing = summaryMap.get(key)
      const shippingCost = Number(order.shippingCost || 0)
      const surcharge = Number(order.surcharge || 0)

      if (existing) {
        existing.totalOrders += 1
        existing.totalShippingCost += shippingCost
        existing.totalSurcharge += surcharge
        existing.totalAmount += shippingCost + surcharge
      } else {
        summaryMap.set(key, {
          shipperId: order.shipperId,
          companyCode: order.shipper.companyCode,
          companyName: order.shipper.companyName,
          month,
          totalOrders: 1,
          totalShippingCost: shippingCost,
          totalSurcharge: surcharge,
          totalAmount: shippingCost + surcharge,
        })
      }
    }

    const rows = Array.from(summaryMap.values()).sort((a, b) => {
      const shipperCmp = a.companyName.localeCompare(b.companyName)
      if (shipperCmp !== 0) return shipperCmp
      return b.month.localeCompare(a.month)
    })

    // Check paid status from Note table (relatedTable=SettlementPaid, relatedId=shipperId_month)
    const paidNotes = await prisma.note.findMany({
      where: { relatedTable: 'SettlementPaid' },
      select: { relatedId: true, content: true, createdAt: true },
    })
    const paidMap = new Map(paidNotes.map((n) => [n.relatedId, n]))

    const data = rows.map((row) => {
      const key = `${row.shipperId}_${row.month}`
      const paidNote = paidMap.get(key)
      return {
        ...row,
        id: key,
        period: row.month,
        status: paidNote ? 'PAID' : 'CONFIRMED',
        paidAt: paidNote?.createdAt ?? null,
      }
    })

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()

    if (!body.shipperId || typeof body.shipperId !== 'string') {
      return errorResponse('화주사 ID는 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.month || typeof body.month !== 'string') {
      return errorResponse('정산 월(YYYY-MM)은 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    // Parse month to date range
    const [year, month] = body.month.split('-').map(Number)
    if (!year || !month || month < 1 || month > 12) {
      return errorResponse('유효하지 않은 월 형식입니다. (YYYY-MM)', 'VALIDATION_ERROR', 400)
    }

    const startOfMonth = new Date(year, month - 1, 1)
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999)

    // Find orders for this shipper in this period
    const orders = await prisma.shipperOrder.findMany({
      where: {
        shipperId: body.shipperId,
        status: 'DELIVERED',
        deliveredAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        shipper: {
          select: { id: true, companyCode: true, companyName: true },
        },
      },
    })

    const totalShippingCost = orders.reduce((sum, o) => sum + Number(o.shippingCost || 0), 0)
    const totalSurcharge = orders.reduce((sum, o) => sum + Number(o.surcharge || 0), 0)

    return successResponse({
      shipperId: body.shipperId,
      month: body.month,
      totalOrders: orders.length,
      totalShippingCost,
      totalSurcharge,
      totalAmount: totalShippingCost + totalSurcharge,
      orders,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
