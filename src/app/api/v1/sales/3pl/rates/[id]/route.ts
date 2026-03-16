import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.shipperRate.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse('요율을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    if (body.shipperId && body.shipperId !== existing.shipperId) {
      const shipper = await prisma.shipperCompany.findUnique({ where: { id: body.shipperId }, select: { id: true } })
      if (!shipper) {
        return errorResponse('화주사를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      }
    }

    const result = await prisma.shipperRate.update({
      where: { id },
      data: {
        ...(body.shipperId !== undefined && { shipperId: body.shipperId }),
        ...(body.rateName !== undefined && { rateName: body.rateName.trim() }),
        ...(body.regionCode !== undefined && { regionCode: body.regionCode || null }),
        ...(body.regionName !== undefined && { regionName: body.regionName || null }),
        ...(body.weightMin !== undefined && { weightMin: body.weightMin }),
        ...(body.weightMax !== undefined && { weightMax: body.weightMax }),
        ...(body.baseRate !== undefined && { baseRate: body.baseRate }),
        ...(body.surchargeRate !== undefined && { surchargeRate: body.surchargeRate }),
        ...(body.shippingMethod !== undefined && { shippingMethod: body.shippingMethod }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.effectiveFrom !== undefined && {
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
        }),
        ...(body.effectiveTo !== undefined && { effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null }),
        ...(body.memo !== undefined && { memo: body.memo || null }),
      },
      include: {
        shipper: {
          select: { id: true, companyCode: true, companyName: true },
        },
      },
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const existing = await prisma.shipperRate.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse('요율을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    await prisma.shipperRate.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
