import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'delete')
    if (isErrorResponse(authResult)) return authResult
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
            // 음수 재고 방지: 현재 잔량 확인 후 차감
            const balance = await tx.stockBalance.findFirst({
              where: { itemId: detail.itemId, warehouseId: movement.targetWarehouseId },
            })
            const currentQty = Number(balance?.quantity ?? 0)
            if (currentQty < Number(detail.quantity)) {
              const item = await tx.item.findUnique({ where: { id: detail.itemId }, select: { itemName: true } })
              throw new Error(
                `품목 "${item?.itemName || detail.itemId}"의 재고가 부족하여 입고 취소할 수 없습니다. (현재고: ${currentQty}, 취소량: ${detail.quantity})`
              )
            }
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
