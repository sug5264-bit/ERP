import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createStockMovementSchema } from '@/lib/validations/inventory'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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
      if (startDate) where.movementDate.gte = new Date(startDate)
      if (endDate) where.movementDate.lte = new Date(endDate)
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
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await request.json()
    const data = createStockMovementSchema.parse(body)

    const movementNo = await generateDocumentNumber('STK', new Date(data.movementDate))

    // 이체 시 출발/도착 창고가 같으면 거부
    if (data.movementType === 'TRANSFER') {
      if (!data.sourceWarehouseId || !data.targetWarehouseId) {
        return errorResponse('이체에는 출발 창고와 도착 창고가 모두 필요합니다.', 'INVALID_WAREHOUSE')
      }
      if (data.sourceWarehouseId === data.targetWarehouseId) {
        return errorResponse('출발 창고와 도착 창고가 동일할 수 없습니다.', 'SAME_WAREHOUSE')
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.stockMovement.create({
        data: {
          movementNo,
          movementDate: new Date(data.movementDate),
          movementType: data.movementType,
          sourceWarehouseId: data.sourceWarehouseId || null,
          targetWarehouseId: data.targetWarehouseId || null,
          relatedDocType: data.relatedDocType || null,
          relatedDocId: data.relatedDocId || null,
          createdBy: session.user!.id!,
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
              throw new Error(`품목 "${item?.itemName || detail.itemId}"의 재고가 부족합니다. (현재고: ${currentQty}, 출고량: ${detail.quantity})`)
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
            await tx.stockBalance.upsert({
              where: {
                itemId_warehouseId_zoneId: {
                  itemId: detail.itemId,
                  warehouseId: data.targetWarehouseId,
                  zoneId: '',
                },
              },
              update: {
                quantity: { increment: detail.quantity },
                lastMovementDate: movementDate,
              },
              create: {
                itemId: detail.itemId,
                warehouseId: data.targetWarehouseId,
                zoneId: '',
                quantity: detail.quantity,
                averageCost: detail.unitPrice || 0,
                lastMovementDate: movementDate,
              },
            })
          }
        }
        if (data.movementType === 'ADJUSTMENT' && data.targetWarehouseId) {
          await tx.stockBalance.upsert({
            where: {
              itemId_warehouseId_zoneId: {
                itemId: detail.itemId,
                warehouseId: data.targetWarehouseId,
                zoneId: '',
              },
            },
            update: {
              quantity: detail.quantity,
              lastMovementDate: movementDate,
            },
            create: {
              itemId: detail.itemId,
              warehouseId: data.targetWarehouseId,
              zoneId: '',
              quantity: detail.quantity,
              averageCost: detail.unitPrice || 0,
              lastMovementDate: movementDate,
            },
          })
        }
      }

      return movement
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
