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
        supplierName: o.partner?.partnerName || '-',
        orderCount: 0,
        totalAmount: 0,
        completedCount: 0,
      }
      existing.orderCount++
      existing.totalAmount += Number(o.totalAmount)
      if (o.status === 'COMPLETED') existing.completedCount++
      supplierMap.set(key, existing)
    }

    const totalAmount = orders.reduce((s, o) => s + Number(o.totalAmount), 0)

    const items = Array.from(supplierMap.entries()).map(([id, v]) => ({
      id,
      supplierName: v.supplierName,
      purchaseCount: v.orderCount,
      purchaseAmount: v.totalAmount,
      ratio: totalAmount > 0 ? (v.totalAmount / totalAmount) * 100 : 0,
    }))

    // Sort by amount descending
    items.sort((a, b) => b.purchaseAmount - a.purchaseAmount)

    return successResponse({
      totalAmount,
      totalCount: orders.length,
      supplierCount: supplierMap.size,
      items,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
