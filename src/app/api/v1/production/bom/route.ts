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
        details: { select: { id: true } },
      },
      orderBy: { bomCode: 'asc' },
    })

    const data = boms.map((b) => ({
      id: b.id,
      bomCode: b.bomCode,
      bomName: b.bomName,
      itemId: b.itemId,
      version: b.version,
      yieldRate: Number(b.yieldRate),
      isActive: b.isActive,
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
  itemId: z.string().min(1),
  version: z.number().int().optional(),
  yieldRate: z.number().optional(),
  isActive: z.boolean().optional(),
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

    const { details, ...headerData } = data
    const bom = await prisma.bomHeader.create({
      data: {
        ...headerData,
        ...(details ? { details: { create: details } } : {}),
      },
      include: { details: true },
    })

    return successResponse(bom)
  } catch (error) {
    return handleApiError(error)
  }
}
