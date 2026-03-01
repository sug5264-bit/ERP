import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createQualityStandardSchema } from '@/lib/validations/sales'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: Record<string, unknown> = { isActive: true }
    const itemId = sp.get('itemId')
    if (itemId) where.itemId = itemId
    const category = sp.get('category')
    if (category) where.category = category

    const [items, totalCount] = await Promise.all([
      prisma.qualityStandard.findMany({
        where,
        include: {
          item: { select: { id: true, itemCode: true, itemName: true, specification: true } },
        },
        orderBy: [{ itemId: 'asc' }, { sortOrder: 'asc' }],
        skip,
        take: pageSize,
      }),
      prisma.qualityStandard.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult
    const body = await request.json()
    const data = createQualityStandardSchema.parse(body)

    const standard = await prisma.qualityStandard.create({
      data: {
        itemId: data.itemId,
        standardName: data.standardName,
        category: data.category,
        checkMethod: data.checkMethod || null,
        spec: data.spec || null,
        minValue: data.minValue ?? null,
        maxValue: data.maxValue ?? null,
        unit: data.unit || null,
        isCritical: data.isCritical,
        sortOrder: data.sortOrder,
      },
      include: { item: { select: { itemCode: true, itemName: true } } },
    })
    return successResponse(standard)
  } catch (error) {
    return handleApiError(error)
  }
}
