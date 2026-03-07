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
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.productionDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [results, totalCount] = await Promise.all([
      prisma.productionResult.findMany({
        where,
        include: {
          productionPlan: {
            select: {
              planNo: true,
              bomHeader: { select: { bomName: true } },
            },
          },
        },
        orderBy: { productionDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.productionResult.count({ where }),
    ])

    const data = results.map((r) => ({
      id: r.id,
      resultNo: r.resultNo,
      planNo: r.productionPlan.planNo,
      productName: r.productionPlan.bomHeader.bomName,
      productionDate: r.productionDate,
      producedQty: Number(r.producedQty),
      defectQty: Number(r.defectQty),
      goodQty: Number(r.goodQty),
      defectRate:
        Number(r.producedQty) > 0 ? Number(((Number(r.defectQty) / Number(r.producedQty)) * 100).toFixed(2)) : 0,
      lotNo: r.lotNo,
      expiryDate: r.expiryDate,
      remarks: r.remarks,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
