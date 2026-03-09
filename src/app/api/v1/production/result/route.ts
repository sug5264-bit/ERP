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
import { createAutoStockMovement } from '@/lib/auto-sync'

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

    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const warnings: string[] = []

    const result = await prisma.$transaction(async (tx) => {
      // 생산계획과 BOM 정보 조회
      const plan = await tx.productionPlan.findUnique({
        where: { id: data.productionPlanId },
        include: {
          bomHeader: {
            include: {
              item: { select: { id: true, itemName: true } },
              details: {
                include: { item: { select: { id: true, itemName: true } } },
              },
            },
          },
        },
      })
      if (!plan) throw new Error('생산계획을 찾을 수 없습니다.')

      const resultNo = await generateDocumentNumber('PR', new Date(data.productionDate), tx)
      const productionResult = await tx.productionResult.create({
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

      // 완제품 입고 재고이동 자동 생성 (양품만)
      if (goodQty > 0) {
        await createAutoStockMovement(
          {
            movementType: 'INBOUND',
            relatedDocType: 'PRODUCTION',
            relatedDocId: productionResult.id,
            movementDate: new Date(data.productionDate),
            details: [
              {
                itemId: plan.bomHeader.itemId,
                quantity: goodQty,
                lotNo: data.lotNo || null,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
              },
            ],
            createdBy: employee.id,
          },
          tx
        )
      }

      // BOM 원자재 출고 재고이동 자동 생성
      if (plan.bomHeader.details.length > 0) {
        const yieldRate = Number(plan.bomHeader.yieldRate) / 100
        const materialDetails = plan.bomHeader.details.map((bomDetail) => ({
          itemId: bomDetail.itemId,
          quantity: Math.ceil((Number(bomDetail.quantity) * data.producedQty) / (yieldRate || 1)),
        }))

        // 원자재 재고 확인 (부족 시 경고 반환, 차단하지 않음)
        for (const md of materialDetails) {
          const stockAgg = await tx.stockBalance.aggregate({
            where: { itemId: md.itemId },
            _sum: { quantity: true },
          })
          const currentStock = Number(stockAgg._sum.quantity ?? 0)
          if (currentStock < md.quantity) {
            const bomDetail = plan.bomHeader.details.find((d) => d.itemId === md.itemId)
            const itemName = bomDetail?.item?.itemName ?? md.itemId
            warnings.push(`원자재 "${itemName}": 필요수량 ${md.quantity}, 가용재고 ${currentStock} (부족)`)
            md.quantity = Math.min(md.quantity, Math.max(0, currentStock))
          }
        }

        const validMaterials = materialDetails.filter((md) => md.quantity > 0)
        if (validMaterials.length > 0) {
          const outMovementNo = await generateDocumentNumber('SM', new Date(data.productionDate), tx)
          await tx.stockMovement.create({
            data: {
              movementNo: outMovementNo,
              movementDate: new Date(data.productionDate),
              movementType: 'OUTBOUND',
              relatedDocType: 'PRODUCTION_MATERIAL',
              relatedDocId: productionResult.id,
              createdBy: employee.id,
              details: {
                create: validMaterials.map((md) => ({
                  itemId: md.itemId,
                  quantity: md.quantity,
                  unitPrice: 0,
                  amount: 0,
                })),
              },
            },
          })

          // 원자재 재고 차감 (낙관적 잠금: 동시성 보호)
          for (const md of validMaterials) {
            const balances = await tx.stockBalance.findMany({
              where: { itemId: md.itemId },
              orderBy: { quantity: 'desc' },
            })
            let remaining = md.quantity
            for (const bal of balances) {
              if (remaining <= 0) break
              const available = Number(bal.quantity)
              const deduct = Math.min(available, remaining)
              if (deduct > 0) {
                const result = await tx.stockBalance.updateMany({
                  where: { id: bal.id, quantity: { gte: deduct } },
                  data: { quantity: { decrement: deduct }, lastMovementDate: new Date() },
                })
                if (result.count === 0) {
                  // 동시 접근으로 재고 변경됨 - 경고 기록 후 재시도 (해당 창고는 건너뛰기)
                  warnings.push(`원자재 ${md.itemId}: 창고 재고가 동시 처리로 변경되어 일부 차감 누락 가능`)
                  continue
                }
                remaining -= deduct
              }
            }
            if (remaining > 0) {
              warnings.push(`원자재 ${md.itemId}: 요청 수량 대비 ${remaining}개 미차감 (재고 부족 또는 동시 처리)`)
            }
          }
        }
      }

      // 생산계획 상태 업데이트
      await tx.productionPlan.update({
        where: { id: data.productionPlanId },
        data: { status: 'IN_PROGRESS' },
      })

      return productionResult
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
      warnings,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
