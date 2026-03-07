import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.orderDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [orders, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          partner: { select: { partnerName: true } },
          employee: { select: { nameKo: true } },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    const data = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      orderDate: o.orderDate,
      supplierName: o.partner.partnerName,
      supplyAmount: Number(o.totalSupply),
      totalAmount: Number(o.totalAmount),
      status: o.status,
      managerName: o.employee.nameKo,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
