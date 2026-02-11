import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { createWarehouseZoneSchema } from '@/lib/validations/inventory'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const body = await request.json()
    const data = createWarehouseZoneSchema.parse({ ...body, warehouseId: id })

    const zone = await prisma.warehouseZone.create({ data })
    return successResponse(zone)
  } catch (error) {
    return handleApiError(error)
  }
}
