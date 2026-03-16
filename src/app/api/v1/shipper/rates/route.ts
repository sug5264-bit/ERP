import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipperId: true, accountType: true },
    })

    if (!user?.shipperId || user.accountType !== 'SHIPPER') {
      return errorResponse('화주사 계정이 아닙니다.', 'FORBIDDEN', 403)
    }

    const shipperId = user.shipperId
    const sp = request.nextUrl.searchParams

    const where: Record<string, unknown> = {
      shipperId,
      isActive: true,
    }

    const shippingMethod = sp.get('shippingMethod')
    if (shippingMethod) {
      where.shippingMethod = shippingMethod
    }

    const rates = await prisma.shipperRate.findMany({
      where,
      orderBy: [{ shippingMethod: 'asc' }, { regionCode: 'asc' }, { weightMin: 'asc' }],
      select: {
        id: true,
        rateName: true,
        regionCode: true,
        regionName: true,
        weightMin: true,
        weightMax: true,
        baseRate: true,
        surchargeRate: true,
        shippingMethod: true,
        effectiveFrom: true,
        effectiveTo: true,
        memo: true,
      },
    })

    return successResponse(rates)
  } catch (error) {
    return handleApiError(error)
  }
}
