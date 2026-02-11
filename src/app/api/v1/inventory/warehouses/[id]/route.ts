import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params

    // Check if warehouse has stock balances
    const stockCount = await prisma.stockBalance.count({ where: { warehouseId: id } })
    if (stockCount > 0) {
      return errorResponse('재고가 존재하는 창고는 삭제할 수 없습니다. 재고를 먼저 이동해주세요.', 'HAS_STOCK')
    }

    // Check if warehouse has stock movements
    const movementCount = await prisma.stockMovement.count({
      where: { OR: [{ sourceWarehouseId: id }, { targetWarehouseId: id }] },
    })
    if (movementCount > 0) {
      return errorResponse('입출고 이력이 있는 창고는 삭제할 수 없습니다.', 'HAS_MOVEMENTS')
    }

    // Delete zones first, then warehouse
    await prisma.$transaction(async (tx) => {
      await tx.warehouseZone.deleteMany({ where: { warehouseId: id } })
      await tx.warehouse.delete({ where: { id } })
    })

    return successResponse({ message: '창고가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
