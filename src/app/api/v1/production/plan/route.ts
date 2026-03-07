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
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.planDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [plans, totalCount] = await Promise.all([
      prisma.productionPlan.findMany({
        where,
        include: {
          bomHeader: { select: { bomName: true, bomCode: true } },
          oemContract: { select: { contractName: true, contractNo: true } },
        },
        orderBy: { planDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.productionPlan.count({ where }),
    ])

    const data = plans.map((p) => ({
      id: p.id,
      planNo: p.planNo,
      planDate: p.planDate,
      bomName: p.bomHeader.bomName,
      bomCode: p.bomHeader.bomCode,
      oemContractName: p.oemContract?.contractName || null,
      plannedQty: Number(p.plannedQty),
      plannedDate: p.plannedDate,
      completionDate: p.completionDate,
      status: p.status,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
