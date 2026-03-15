import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requireAuth,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}

    const shipperId = sp.get('shipperId')
    if (shipperId) where.shipperId = shipperId

    const regionCode = sp.get('regionCode')
    if (regionCode) where.regionCode = regionCode

    const shippingMethod = sp.get('shippingMethod')
    if (shippingMethod) where.shippingMethod = shippingMethod

    const isActive = sp.get('isActive')
    if (isActive === 'true') where.isActive = true
    else if (isActive === 'false') where.isActive = false

    const [items, totalCount] = await Promise.all([
      prisma.shipperRate.findMany({
        where,
        include: {
          shipper: {
            select: { id: true, companyCode: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.shipperRate.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()

    if (!body.shipperId) {
      return errorResponse('화주사 ID는 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.rateName || typeof body.rateName !== 'string' || body.rateName.trim() === '') {
      return errorResponse('요율명은 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (body.baseRate === undefined || body.baseRate === null || Number(body.baseRate) < 0) {
      return errorResponse('기본 요율은 필수이며 0 이상이어야 합니다.', 'VALIDATION_ERROR', 400)
    }

    // Verify shipper exists
    const shipper = await prisma.shipperCompany.findUnique({
      where: { id: body.shipperId },
      select: { id: true },
    })
    if (!shipper) {
      return errorResponse('화주사를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    const result = await prisma.shipperRate.create({
      data: {
        shipperId: body.shipperId,
        rateName: body.rateName.trim(),
        regionCode: body.regionCode || null,
        regionName: body.regionName || null,
        weightMin: body.weightMin ?? null,
        weightMax: body.weightMax ?? null,
        baseRate: body.baseRate,
        surchargeRate: body.surchargeRate ?? 0,
        shippingMethod: body.shippingMethod || 'NORMAL',
        isActive: body.isActive ?? true,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        memo: body.memo || null,
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
