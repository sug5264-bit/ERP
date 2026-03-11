import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('production', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const id = sp.get('id')

    // 단건 조회 (id가 있을 경우)
    if (id) {
      const bom = await prisma.bomHeader.findUnique({
        where: { id },
        include: {
          details: {
            orderBy: { lineNo: 'asc' },
          },
        },
      })
      if (!bom) return errorResponse('BOM을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      return successResponse(bom)
    }

    const boms = await prisma.bomHeader.findMany({
      include: {
        item: { select: { itemName: true } },
        details: { select: { id: true } },
      },
      orderBy: { bomCode: 'asc' },
    })

    const data = boms.map((b) => ({
      id: b.id,
      bomCode: b.bomCode,
      bomName: b.bomName,
      itemId: b.itemId,
      productName: b.item?.itemName || '',
      version: `v${b.version}.0`,
      yieldRate: Number(b.yieldRate),
      status: b.isActive ? 'ACTIVE' : 'INACTIVE',
      materialCount: b.details.length,
      description: b.description,
      createdAt: b.createdAt,
    }))

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

const createBomSchema = z.object({
  bomCode: z.string().min(1),
  bomName: z.string().min(1),
  itemId: z.string().min(1).optional(),
  productName: z.string().optional(),
  version: z.union([z.number().int(), z.string()]).optional(),
  yieldRate: z.number().optional(),
  isActive: z.boolean().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  details: z
    .array(
      z.object({
        lineNo: z.number().int(),
        itemId: z.string().min(1),
        quantity: z.number(),
        unit: z.string().optional(),
        lossRate: z.number().optional(),
        remark: z.string().optional(),
      })
    )
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('production', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createBomSchema.parse(body)

    const exists = await prisma.bomHeader.findUnique({ where: { bomCode: data.bomCode } })
    if (exists) return errorResponse('이미 존재하는 BOM 코드입니다.', 'DUPLICATE', 409)

    // Resolve productName to itemId if needed
    let itemId = data.itemId
    if (!itemId && data.productName) {
      const item = await prisma.item.findFirst({
        where: { itemName: { contains: data.productName, mode: 'insensitive' } },
      })
      if (!item) return errorResponse('완제품을 찾을 수 없습니다.', 'NOT_FOUND', 404)
      itemId = item.id
    }
    if (!itemId) return errorResponse('완제품(itemId)이 필요합니다.', 'VALIDATION_ERROR', 400)

    // Parse version string like "v1.0" to integer
    const version =
      typeof data.version === 'string' ? parseInt(data.version.replace(/[^0-9]/g, ''), 10) || 1 : data.version || 1

    const isActive = data.status ? data.status === 'ACTIVE' : data.isActive !== false

    const { details, productName: _pn, status: _st, itemId: _iid, version: _v, ...rest } = data
    const bom = await prisma.bomHeader.create({
      data: {
        ...rest,
        itemId,
        version,
        isActive,
        ...(details ? { details: { create: details } } : {}),
      },
      include: { details: true },
    })

    return successResponse(bom)
  } catch (error) {
    return handleApiError(error)
  }
}
