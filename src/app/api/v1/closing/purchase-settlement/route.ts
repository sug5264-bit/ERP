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

    // 매입처별 발주 금액 집계
    const orders = await prisma.purchaseOrder.findMany({
      where: dateFilter,
      include: {
        partner: { select: { id: true, partnerName: true } },
      },
    })

    // 매입처별 지급 내역 집계
    const payments = await prisma.purchasePayment.findMany({
      where: {
        status: 'COMPLETED',
        ...(startDate || endDate
          ? {
              paymentDate: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
    })

    const paymentByPartner = new Map<string, number>()
    for (const p of payments) {
      const cur = paymentByPartner.get(p.partnerId) || 0
      paymentByPartner.set(p.partnerId, cur + Number(p.totalAmount))
    }

    const supplierMap = new Map<string, { supplierName: string; purchaseCount: number; purchaseAmount: number }>()
    for (const o of orders) {
      const key = o.partnerId
      const existing = supplierMap.get(key) || {
        supplierName: o.partner.partnerName,
        purchaseCount: 0,
        purchaseAmount: 0,
      }
      existing.purchaseCount++
      existing.purchaseAmount += Number(o.totalAmount)
      supplierMap.set(key, existing)
    }

    const data = Array.from(supplierMap.entries()).map(([id, v]) => {
      const paidAmount = paymentByPartner.get(id) || 0
      const unpaidAmount = v.purchaseAmount - paidAmount
      return {
        id,
        supplierName: v.supplierName,
        purchaseCount: v.purchaseCount,
        purchaseAmount: v.purchaseAmount,
        paidAmount,
        unpaidAmount,
        status: unpaidAmount <= 0 ? 'COMPLETED' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
      }
    })

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}
