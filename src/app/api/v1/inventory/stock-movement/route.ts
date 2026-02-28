import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createStockMovementSchema } from '@/lib/validations/inventory'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: any = {}
    const movementType = sp.get('movementType')
    if (movementType) where.movementType = movementType
    const warehouseId = sp.get('warehouseId')
    if (warehouseId) {
      where.OR = [{ sourceWarehouseId: warehouseId }, { targetWarehouseId: warehouseId }]
    }
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.movementDate = {}
      if (startDate) {
        const d = new Date(startDate)
        if (!isNaN(d.getTime())) where.movementDate.gte = d
      }
      if (endDate) {
        const d = new Date(endDate)
        if (!isNaN(d.getTime())) where.movementDate.lte = d
      }
    }

    const [movements, totalCount] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          sourceWarehouse: true,
          targetWarehouse: true,
          details: { include: { item: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.stockMovement.count({ where }),
    ])

    return successResponse(movements, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createStockMovementSchema.parse(body)

    // 창고 필수 검증
    if (data.movementType === 'INBOUND' && !data.targetWarehouseId) {
      return errorResponse('입고에는 대상 창고가 필요합니다.', 'MISSING_WAREHOUSE')
    }
    if (data.movementType === 'OUTBOUND' && !data.sourceWarehouseId) {
      return errorResponse('출고에는 출발 창고가 필요합니다.', 'MISSING_WAREHOUSE')
    }
    if (data.movementType === 'TRANSFER') {
      if (!data.sourceWarehouseId || !data.targetWarehouseId) {
        return errorResponse('이체에는 출발 창고와 도착 창고가 모두 필요합니다.', 'INVALID_WAREHOUSE')
      }
      if (data.sourceWarehouseId === data.targetWarehouseId) {
        return errorResponse('출발 창고와 도착 창고가 동일할 수 없습니다.', 'SAME_WAREHOUSE')
      }
    }
    if (data.movementType === 'ADJUSTMENT' && !data.targetWarehouseId) {
      return errorResponse('재고조정에는 대상 창고가 필요합니다.', 'MISSING_WAREHOUSE')
    }

    // 사원 정보 조회 (createdBy에 Employee ID 사용)
    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const result = await prisma.$transaction(async (tx) => {
      const movementNo = await generateDocumentNumber('STK', new Date(data.movementDate), tx)
      const movement = await tx.stockMovement.create({
        data: {
          movementNo,
          movementDate: new Date(data.movementDate),
          movementType: data.movementType,
          sourceWarehouseId: data.sourceWarehouseId || null,
          targetWarehouseId: data.targetWarehouseId || null,
          relatedDocType: data.relatedDocType || null,
          relatedDocId: data.relatedDocId || null,
          createdBy: employee.id,
          details: {
            create: data.details.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice || 0,
              amount: d.quantity * (d.unitPrice || 0),
              lotNo: d.lotNo || null,
              expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
            })),
          },
        },
        include: { details: { include: { item: true } }, sourceWarehouse: true, targetWarehouse: true },
      })

      // 재고 업데이트 - 순차 처리로 동일 품목 레이스 컨디션 방지
      const movementDate = new Date(data.movementDate)
      for (const detail of data.details) {
        // 출고 먼저 처리 (재고 부족 검증이 정확하도록)
        if (data.movementType === 'OUTBOUND' || data.movementType === 'TRANSFER') {
          if (data.sourceWarehouseId) {
            const balance = await tx.stockBalance.findFirst({
              where: { itemId: detail.itemId, warehouseId: data.sourceWarehouseId },
              select: { quantity: true },
            })
            const currentQty = Number(balance?.quantity ?? 0)
            if (currentQty < detail.quantity) {
              const item = await tx.item.findUnique({ where: { id: detail.itemId }, select: { itemName: true } })
              throw new Error(
                `품목 "${item?.itemName || detail.itemId}"의 재고가 부족합니다. (현재고: ${currentQty}, 출고량: ${detail.quantity})`
              )
            }
            await tx.stockBalance.updateMany({
              where: { itemId: detail.itemId, warehouseId: data.sourceWarehouseId },
              data: {
                quantity: { decrement: detail.quantity },
                lastMovementDate: movementDate,
              },
            })
          }
        }
        // 입고 처리
        if (data.movementType === 'INBOUND' || data.movementType === 'TRANSFER') {
          if (data.targetWarehouseId) {
            const existing = await tx.stockBalance.findFirst({
              where: { itemId: detail.itemId, warehouseId: data.targetWarehouseId },
            })
            if (existing) {
              // 가중평균단가 계산
              const oldQty = Number(existing.quantity)
              const oldCost = Number(existing.averageCost)
              const newQty = detail.quantity
              const newPrice = detail.unitPrice || 0
              const totalQty = oldQty + newQty
              const newAvgCost =
                totalQty > 0 ? Math.round(((oldQty * oldCost + newQty * newPrice) / totalQty) * 100) / 100 : 0
              await tx.stockBalance.update({
                where: { id: existing.id },
                data: {
                  quantity: { increment: detail.quantity },
                  averageCost: newAvgCost,
                  lastMovementDate: movementDate,
                },
              })
            } else {
              await tx.stockBalance.create({
                data: {
                  itemId: detail.itemId,
                  warehouseId: data.targetWarehouseId,
                  quantity: detail.quantity,
                  averageCost: detail.unitPrice || 0,
                  lastMovementDate: movementDate,
                },
              })
            }
          }
        }
        if (data.movementType === 'ADJUSTMENT' && data.targetWarehouseId) {
          const existing = await tx.stockBalance.findFirst({
            where: { itemId: detail.itemId, warehouseId: data.targetWarehouseId },
          })
          if (existing) {
            await tx.stockBalance.update({
              where: { id: existing.id },
              data: {
                quantity: detail.quantity,
                lastMovementDate: movementDate,
              },
            })
          } else {
            await tx.stockBalance.create({
              data: {
                itemId: detail.itemId,
                warehouseId: data.targetWarehouseId,
                quantity: detail.quantity,
                averageCost: detail.unitPrice || 0,
                lastMovementDate: movementDate,
              },
            })
          }
        }
      }

      return movement
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
