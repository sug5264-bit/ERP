import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const sp = request.nextUrl.searchParams
    const warehouseId = sp.get('warehouseId')
    const itemId = sp.get('itemId')
    const belowSafety = sp.get('belowSafety')

    const where: any = {}
    if (warehouseId) where.warehouseId = warehouseId
    if (itemId) where.itemId = itemId

    const balances = await prisma.stockBalance.findMany({
      where,
      include: {
        item: { include: { category: true } },
        warehouse: true,
        zone: true,
      },
      orderBy: [{ warehouse: { code: 'asc' } }, { item: { itemCode: 'asc' } }],
    })

    let result = balances
    if (belowSafety === 'true') {
      result = balances.filter((b) => Number(b.quantity) < b.item.safetyStock)
    }

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
