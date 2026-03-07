import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('closing', 'read')
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

    // 거래처별 매출 집계
    const orders = await prisma.salesOrder.findMany({
      where: {
        ...dateFilter,
        status: { not: 'CANCELLED' },
      },
      include: {
        partner: { select: { id: true, partnerName: true } },
      },
    })

    const partnerMap = new Map<
      string,
      { partnerName: string; salesCount: number; salesAmount: number; collectedAmount: number }
    >()
    for (const o of orders) {
      if (!o.partnerId) continue
      const key = o.partnerId
      const existing = partnerMap.get(key) || {
        partnerName: o.partner?.partnerName || '-',
        salesCount: 0,
        salesAmount: 0,
        collectedAmount: 0,
      }
      existing.salesCount++
      existing.salesAmount += Number(o.totalAmount)
      if (o.status === 'COMPLETED') {
        existing.collectedAmount += Number(o.totalAmount)
      }
      partnerMap.set(key, existing)
    }

    const data = Array.from(partnerMap.entries()).map(([id, v]) => {
      const uncollectedAmount = v.salesAmount - v.collectedAmount
      return {
        id,
        partnerName: v.partnerName,
        salesCount: v.salesCount,
        salesAmount: v.salesAmount,
        collectedAmount: v.collectedAmount,
        uncollectedAmount,
        status: uncollectedAmount <= 0 ? 'COMPLETED' : v.collectedAmount > 0 ? 'PARTIAL' : 'PENDING',
      }
    })

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}
