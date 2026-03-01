import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createPartnerSchema } from '@/lib/validations/inventory'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const rawSearch = sp.get('search')
    if (rawSearch) {
      const search = sanitizeSearchQuery(rawSearch)
      where.OR = [
        { partnerCode: { contains: search, mode: 'insensitive' } },
        { partnerName: { contains: search, mode: 'insensitive' } },
        { bizNo: { contains: search, mode: 'insensitive' } },
      ]
    }
    const partnerType = sp.get('partnerType')
    if (partnerType) where.partnerType = partnerType
    const isActive = sp.get('isActive')
    if (isActive) where.isActive = isActive === 'true'

    const [partners, totalCount] = await Promise.all([
      prisma.partner.findMany({
        where,
        orderBy: { partnerCode: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.partner.count({ where }),
    ])

    return successResponse(partners, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createPartnerSchema.parse(body)

    const exists = await prisma.partner.findUnique({ where: { partnerCode: data.partnerCode } })
    if (exists) return errorResponse('이미 존재하는 거래처코드입니다.', 'DUPLICATE')

    const partner = await prisma.partner.create({ data })
    return successResponse(partner)
  } catch (error) {
    return handleApiError(error)
  }
}
