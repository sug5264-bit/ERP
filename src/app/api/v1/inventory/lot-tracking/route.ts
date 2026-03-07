import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const rawLotNo = sp.get('lotNo')

    if (!rawLotNo) {
      return successResponse([])
    }

    const lotNo = sanitizeSearchQuery(rawLotNo)

    // LOT 번호로 재고 이동 내역 조회
    const movements = await prisma.stockMovementDetail.findMany({
      where: {
        lotNo: { contains: lotNo, mode: 'insensitive' },
      },
      include: {
        stockMovement: {
          select: {
            movementNo: true,
            movementDate: true,
            movementType: true,
            sourceWarehouse: { select: { name: true } },
            targetWarehouse: { select: { name: true } },
          },
        },
        item: { select: { itemCode: true, itemName: true } },
      },
      orderBy: {
        stockMovement: { movementDate: 'desc' },
      },
    })

    const data = movements.map((m) => ({
      id: m.id,
      lotNo: m.lotNo,
      movementNo: m.stockMovement.movementNo,
      movementDate: m.stockMovement.movementDate,
      movementType: m.stockMovement.movementType,
      itemCode: m.item.itemCode,
      itemName: m.item.itemName,
      quantity: Number(m.quantity),
      unitPrice: Number(m.unitPrice),
      amount: Number(m.amount),
      expiryDate: m.expiryDate,
      sourceWarehouse: m.stockMovement.sourceWarehouse?.name || '-',
      targetWarehouse: m.stockMovement.targetWarehouse?.name || '-',
    }))

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}
