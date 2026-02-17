import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'
import { createItemCategorySchema } from '@/lib/validations/inventory'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const categories = await prisma.itemCategory.findMany({
      include: { _count: { select: { items: true, children: true } } },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    })
    return successResponse(categories, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await request.json()
    const data = createItemCategorySchema.parse(body)

    const exists = await prisma.itemCategory.findUnique({ where: { code: data.code } })
    if (exists) return errorResponse('이미 존재하는 분류코드입니다.', 'DUPLICATE')

    if (data.parentId) {
      const parent = await prisma.itemCategory.findUnique({ where: { id: data.parentId } })
      if (parent) data.level = parent.level + 1
    }

    const category = await prisma.itemCategory.create({ data })
    return successResponse(category)
  } catch (error) {
    return handleApiError(error)
  }
}
