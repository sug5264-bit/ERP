import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { createItemCategorySchema } from '@/lib/validations/inventory'

export async function GET() {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const categories = await prisma.itemCategory.findMany({
      include: { _count: { select: { items: true, children: true } } },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    })
    return successResponse(categories)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createItemCategorySchema.parse(body)

    const exists = await prisma.itemCategory.findUnique({ where: { code: data.code } })
    if (exists) return errorResponse('이미 존재하는 분류코드입니다.', 'DUPLICATE', 409)

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
