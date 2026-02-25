import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const warehouse = await prisma.warehouse.findUnique({ where: { id } })
    if (!warehouse) return errorResponse('창고를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // 재고 이동 이력이 있으면 삭제 차단
    const movementCount = await prisma.stockMovement.count({
      where: { OR: [{ sourceWarehouseId: id }, { targetWarehouseId: id }] },
    })
    if (movementCount > 0) {
      return errorResponse('재고 이동 이력이 있는 창고는 삭제할 수 없습니다.', 'HAS_MOVEMENTS', 400)
    }

    // 재고 잔량이 있으면 삭제 차단
    const stockCount = await prisma.stockBalance.count({
      where: { warehouseId: id, quantity: { gt: 0 } },
    })
    if (stockCount > 0) {
      return errorResponse('재고가 남아있는 창고는 삭제할 수 없습니다.', 'HAS_STOCK', 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockBalance.deleteMany({ where: { warehouseId: id } })
      await tx.warehouseZone.deleteMany({ where: { warehouseId: id } })
      await tx.warehouse.delete({ where: { id } })
    })

    return successResponse({ message: '창고가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
