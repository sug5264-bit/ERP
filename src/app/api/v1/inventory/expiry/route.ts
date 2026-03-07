import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const daysLeft = parseInt(sp.get('daysLeft') || '30', 10)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() + daysLeft)

    const balances = await prisma.stockBalance.findMany({
      where: {
        expiryDate: { lte: cutoffDate },
        quantity: { gt: 0 },
      },
      include: {
        item: { select: { itemCode: true, itemName: true, unit: true, storageTemp: true } },
        warehouse: { select: { name: true, code: true } },
      },
      orderBy: { expiryDate: 'asc' },
    })

    const today = new Date()
    const data = balances.map((b) => {
      const expiryDate = b.expiryDate!
      const diffMs = expiryDate.getTime() - today.getTime()
      const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      return {
        id: b.id,
        itemCode: b.item.itemCode,
        itemName: b.item.itemName,
        unit: b.item.unit,
        storageTemp: b.item.storageTemp,
        warehouseName: b.warehouse.name,
        lotNo: b.lotNo,
        expiryDate,
        remainingDays,
        quantity: Number(b.quantity),
        status:
          remainingDays <= 0 ? 'EXPIRED' : remainingDays <= 7 ? 'CRITICAL' : remainingDays <= 14 ? 'WARNING' : 'NORMAL',
      }
    })

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}
