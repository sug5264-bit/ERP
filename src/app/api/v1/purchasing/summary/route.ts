import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')

    const dateFilter: Record<string, unknown> = {}
    if (startDate || endDate) {
      dateFilter.orderDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: dateFilter,
      include: {
        partner: { select: { id: true, partnerName: true } },
      },
    })

    // 매입처별 집계
    const supplierMap = new Map<
      string,
      { supplierName: string; orderCount: number; totalAmount: number; completedCount: number }
    >()
    for (const o of orders) {
      const key = o.partnerId
      const existing = supplierMap.get(key) || {
        supplierName: o.partner.partnerName,
        orderCount: 0,
        totalAmount: 0,
        completedCount: 0,
      }
      existing.orderCount++
      existing.totalAmount += Number(o.totalAmount)
      if (o.status === 'COMPLETED') existing.completedCount++
      supplierMap.set(key, existing)
    }

    const items = Array.from(supplierMap.entries()).map(([id, v]) => ({
      id,
      supplierName: v.supplierName,
      orderCount: v.orderCount,
      totalAmount: v.totalAmount,
      completedCount: v.completedCount,
      pendingCount: v.orderCount - v.completedCount,
    }))

    const summary = {
      totalOrders: orders.length,
      totalAmount: orders.reduce((s, o) => s + Number(o.totalAmount), 0),
      completedCount: orders.filter((o) => o.status === 'COMPLETED').length,
      inProgressCount: orders.filter((o) => o.status === 'IN_PROGRESS' || o.status === 'ORDERED').length,
    }

    return successResponse({ items, summary })
  } catch (error) {
    return handleApiError(error)
  }
}
