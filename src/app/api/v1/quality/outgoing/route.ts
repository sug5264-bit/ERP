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
    const authResult = await requirePermissionCheck('quality', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const judgement = sp.get('judgement')
    if (judgement && judgement !== 'all') where.judgement = judgement
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.inspectionDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [inspections, totalCount] = await Promise.all([
      prisma.qualityInspection.findMany({
        where,
        include: {
          delivery: {
            select: {
              deliveryNo: true,
              partner: { select: { partnerName: true } },
            },
          },
        },
        orderBy: { inspectionDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.qualityInspection.count({ where }),
    ])

    const data = inspections.map((i) => ({
      id: i.id,
      inspectionNo: i.inspectionNo,
      deliveryNo: i.delivery.deliveryNo,
      partnerName: i.delivery.partner?.partnerName || '-',
      inspectionDate: i.inspectionDate,
      inspectorName: i.inspectorName,
      overallGrade: i.overallGrade,
      status: i.status,
      sampleSize: i.sampleSize,
      defectCount: i.defectCount,
      defectRate: Number(i.defectRate),
      lotNo: i.lotNo,
      judgement: i.judgement,
      remarks: i.remarks,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
