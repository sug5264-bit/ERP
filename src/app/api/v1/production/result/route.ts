import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
  errorResponse,
} from '@/lib/api-helpers'
import { z } from 'zod'
import { generateDocumentNumber } from '@/lib/doc-number'

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

const createProductionResultSchema = z.object({
  productionPlanId: z.string().min(1, '생산계획을 선택하세요'),
  productionDate: z
    .string()
    .min(1, '생산일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  producedQty: z.number().min(1, '생산수량은 1 이상이어야 합니다').max(999_999_999),
  defectQty: z.number().min(0).max(999_999_999).default(0),
  lotNo: z.string().max(100).optional().nullable(),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  remarks: z.string().max(1000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createProductionResultSchema.parse(body)

    const goodQty = data.producedQty - data.defectQty
    if (goodQty < 0) {
      return errorResponse('불량수량이 생산수량을 초과할 수 없습니다.', 'VALIDATION_ERROR', 400)
    }

    const resultNo = await generateDocumentNumber('PR', new Date(data.productionDate))

    const result = await prisma.productionResult.create({
      data: {
        resultNo,
        productionPlanId: data.productionPlanId,
        productionDate: new Date(data.productionDate),
        producedQty: data.producedQty,
        defectQty: data.defectQty,
        goodQty,
        lotNo: data.lotNo || undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        remarks: data.remarks || undefined,
      },
      include: {
        productionPlan: { select: { planNo: true } },
      },
    })

    return successResponse({
      id: result.id,
      resultNo: result.resultNo,
      planNo: result.productionPlan.planNo,
      productionDate: result.productionDate,
      producedQty: Number(result.producedQty),
      defectQty: Number(result.defectQty),
      goodQty: Number(result.goodQty),
      lotNo: result.lotNo,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
