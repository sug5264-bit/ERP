import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    await prisma.$transaction(async (tx) => {
      await tx.stockBalance.deleteMany({ where: { warehouseId: id } })
      const movements = await tx.stockMovement.findMany({
        where: { OR: [{ sourceWarehouseId: id }, { targetWarehouseId: id }] },
        select: { id: true },
      })
      if (movements.length > 0) {
        const movementIds = movements.map((m) => m.id)
        await tx.stockMovementDetail.deleteMany({ where: { stockMovementId: { in: movementIds } } })
        await tx.stockMovement.deleteMany({ where: { id: { in: movementIds } } })
      }
      await tx.warehouseZone.deleteMany({ where: { warehouseId: id } })
      await tx.warehouse.delete({ where: { id } })
    })

    return successResponse({ message: '창고가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
