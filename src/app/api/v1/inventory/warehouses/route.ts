import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { createWarehouseSchema } from '@/lib/validations/inventory'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const warehouses = await prisma.warehouse.findMany({
      include: {
        zones: { select: { id: true, zoneCode: true, zoneName: true }, orderBy: { zoneCode: 'asc' } },
        _count: { select: { stockBalances: true } },
      },
      orderBy: { code: 'asc' },
    })
    return successResponse(warehouses, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await request.json()
    const data = createWarehouseSchema.parse(body)

    const exists = await prisma.warehouse.findUnique({ where: { code: data.code } })
    if (exists) return errorResponse('이미 존재하는 창고코드입니다.', 'DUPLICATE')

    const warehouse = await prisma.warehouse.create({ data })
    return successResponse(warehouse)
  } catch (error) {
    return handleApiError(error)
  }
}
