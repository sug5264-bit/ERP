import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createPartnerSchema } from '@/lib/validations/inventory'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: any = {}
    const search = sp.get('search')
    if (search) {
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

    return successResponse(partners, buildMeta(page, pageSize, totalCount), { cache: 's-maxage=60, stale-while-revalidate=120' })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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
