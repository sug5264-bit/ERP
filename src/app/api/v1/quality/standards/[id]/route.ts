import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.qualityStandard.findUnique({ where: { id } })
    if (!existing) return errorResponse('품질기준을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const updated = await prisma.qualityStandard.update({
      where: { id },
      data: {
        ...(body.standardName !== undefined && { standardName: body.standardName }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.checkMethod !== undefined && { checkMethod: body.checkMethod }),
        ...(body.spec !== undefined && { spec: body.spec }),
        ...(body.minValue !== undefined && { minValue: body.minValue }),
        ...(body.maxValue !== undefined && { maxValue: body.maxValue }),
        ...(body.unit !== undefined && { unit: body.unit }),
        ...(body.isCritical !== undefined && { isCritical: body.isCritical }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      include: { item: { select: { itemCode: true, itemName: true } } },
    })
    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'delete')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params

    const existing = await prisma.qualityStandard.findUnique({ where: { id } })
    if (!existing) return errorResponse('품질기준을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    await prisma.qualityStandard.update({
      where: { id },
      data: { isActive: false },
    })
    return successResponse({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
