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
      where.receivingDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [items, totalCount] = await Promise.all([
      prisma.receiving.findMany({
        where,
        include: {
          purchaseOrder: { select: { orderNo: true } },
          partner: { select: { partnerName: true } },
        },
        orderBy: { receivingDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.receiving.count({ where }),
    ])

    const data = items.map((r) => ({
      id: r.id,
      receivingNo: r.receivingNo,
      receivingDate: r.receivingDate,
      orderNo: r.purchaseOrder.orderNo,
      supplierName: r.partner.partnerName,
      status: r.status,
      inspectorName: r.inspectedBy || '-',
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
