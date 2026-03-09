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
import { z } from 'zod'
import { generateDocumentNumber } from '@/lib/doc-number'

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

const createProductionPlanSchema = z.object({
  planDate: z
    .string()
    .min(1, '계획일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  bomHeaderId: z.string().min(1, '배합표를 선택하세요'),
  oemContractId: z.string().optional().nullable(),
  plannedQty: z.number().min(1, '계획수량은 1 이상이어야 합니다').max(999_999_999),
  plannedDate: z
    .string()
    .min(1, '생산예정일을 입력하세요')
    .regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다'),
  description: z.string().max(1000).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createProductionPlanSchema.parse(body)

    const plan = await prisma.$transaction(async (tx) => {
      const planNo = await generateDocumentNumber('PP', new Date(data.planDate))
      return tx.productionPlan.create({
        data: {
          planNo,
          planDate: new Date(data.planDate),
          bomHeaderId: data.bomHeaderId,
          oemContractId: data.oemContractId || undefined,
          plannedQty: data.plannedQty,
          plannedDate: new Date(data.plannedDate),
          description: data.description || undefined,
        },
        include: {
          bomHeader: { select: { bomName: true } },
          oemContract: { select: { contractName: true } },
        },
      })
    })

    return successResponse({
      id: plan.id,
      planNo: plan.planNo,
      planDate: plan.planDate,
      bomName: plan.bomHeader.bomName,
      oemContractName: plan.oemContract?.contractName || null,
      plannedQty: Number(plan.plannedQty),
      plannedDate: plan.plannedDate,
      status: plan.status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
