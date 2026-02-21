import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const { id } = await params

    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: { details: true },
    })
    if (!movement) return errorResponse('입출고 내역을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (movement.movementType === 'ADJUSTMENT') {
      return errorResponse(
        '재고조정 내역은 삭제할 수 없습니다. 새로운 조정으로 보정하세요.',
        'CANNOT_DELETE_ADJUSTMENT',
        400
      )
    }

    // 재고 원복 처리
    await prisma.$transaction(async (tx) => {
      for (const detail of movement.details) {
        if (movement.movementType === 'INBOUND' || movement.movementType === 'TRANSFER') {
          if (movement.targetWarehouseId) {
            await tx.stockBalance.updateMany({
              where: { itemId: detail.itemId, warehouseId: movement.targetWarehouseId },
              data: { quantity: { decrement: detail.quantity } },
            })
          }
        }
        if (movement.movementType === 'OUTBOUND' || movement.movementType === 'TRANSFER') {
          if (movement.sourceWarehouseId) {
            await tx.stockBalance.updateMany({
              where: { itemId: detail.itemId, warehouseId: movement.sourceWarehouseId },
              data: { quantity: { increment: detail.quantity } },
            })
          }
        }
      }

      await tx.stockMovementDetail.deleteMany({ where: { stockMovementId: id } })
      await tx.stockMovement.delete({ where: { id } })
    })

    return successResponse({ message: '입출고 내역이 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
