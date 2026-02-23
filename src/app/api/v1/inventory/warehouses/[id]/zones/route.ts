import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'
import { createWarehouseZoneSchema } from '@/lib/validations/inventory'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await request.json()
    const data = createWarehouseZoneSchema.parse({ ...body, warehouseId: id })

    const zone = await prisma.warehouseZone.create({ data })
    return successResponse(zone)
  } catch (error) {
    return handleApiError(error)
  }
}
