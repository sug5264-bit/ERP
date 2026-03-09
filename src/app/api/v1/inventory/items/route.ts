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
import { cached, invalidateCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
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

    // 필터 없는 대량 조회(Select 옵션용)는 캐시 적용
    const cacheKey = !rawSearch && !itemType && !categoryId && !isActive ? `items:list:${page}:${pageSize}` : null

    const fetchData = () =>
      Promise.all([
        prisma.item.findMany({
          where,
          include: { category: { select: { id: true, code: true, name: true } } },
          orderBy: { itemCode: 'asc' },
          skip,
          take: pageSize,
        }),
        prisma.item.count({ where }),
      ])

    const [items, totalCount] = cacheKey ? await cached(cacheKey, fetchData, 3 * 60 * 1000) : await fetchData()

    return successResponse(items, buildMeta(page, pageSize, totalCount))
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
    if (exists) return errorResponse('이미 존재하는 품목코드입니다.', 'DUPLICATE', 409)

    const item = await prisma.item.create({ data: { ...data, standardPrice: data.standardPrice } })
    invalidateCache('items:*')
    return successResponse(item)
  } catch (error) {
    return handleApiError(error)
  }
}
