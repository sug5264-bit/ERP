import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { createWarehouseSchema } from '@/lib/validations/inventory'

export async function GET() {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const warehouses = await prisma.warehouse.findMany({
      include: {
        zones: { select: { id: true, zoneCode: true, zoneName: true }, orderBy: { zoneCode: 'asc' } },
        _count: { select: { stockBalances: true } },
      },
      orderBy: { code: 'asc' },
    })
    return successResponse(warehouses)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

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
