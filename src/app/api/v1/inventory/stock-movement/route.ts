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

      // Update stock balances - 병렬 실행으로 성능 개선
      const movementDate = new Date(data.movementDate)
      await Promise.all(data.details.map(async (detail) => {
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
                zoneId: null,
                quantity: detail.quantity,
                averageCost: detail.unitPrice || 0,
                lastMovementDate: movementDate,
              },
            })
          }
        }
        if (data.movementType === 'OUTBOUND' || data.movementType === 'TRANSFER') {
          if (data.sourceWarehouseId) {
            await tx.stockBalance.updateMany({
              where: { itemId: detail.itemId, warehouseId: data.sourceWarehouseId },
              data: {
                quantity: { decrement: detail.quantity },
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
              zoneId: null,
              quantity: detail.quantity,
              averageCost: detail.unitPrice || 0,
              lastMovementDate: movementDate,
            },
          })
        }
      }))

      return movement
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
