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
import { createItemSchema } from '@/lib/validations/inventory'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: any = {}
    const rawSearch = sp.get('search')
    if (rawSearch) {
      const search = sanitizeSearchQuery(rawSearch)
      where.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { itemName: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }
    const itemType = sp.get('itemType')
    if (itemType) where.itemType = itemType
    const categoryId = sp.get('categoryId')
    if (categoryId) where.categoryId = categoryId
    const isActive = sp.get('isActive')
    if (isActive) where.isActive = isActive === 'true'

    const [items, totalCount] = await Promise.all([
      prisma.item.findMany({
        where,
        include: { category: { select: { id: true, code: true, name: true } } },
        orderBy: { itemCode: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.item.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount), {
      cache: 's-maxage=60, stale-while-revalidate=120',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createItemSchema.parse(body)

    const exists = await prisma.item.findUnique({ where: { itemCode: data.itemCode } })
    if (exists) return errorResponse('이미 존재하는 품목코드입니다.', 'DUPLICATE')

    const item = await prisma.item.create({ data: { ...data, standardPrice: data.standardPrice } })
    return successResponse(item)
  } catch (error) {
    return handleApiError(error)
  }
}
