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

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('production', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params

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
  } catch (error) {
    return handleApiError(error)
  }
}

const updateBomSchema = z.object({
  bomName: z.string().min(1).optional(),
  itemId: z.string().min(1).optional(),
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

export async function PUT(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('production', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params
    const body = await request.json()
    const data = updateBomSchema.parse(body)

    const { details, ...headerData } = data

    const bom = await prisma.bomHeader.update({
      where: { id },
      data: {
        ...headerData,
        ...(details
          ? {
              details: {
                deleteMany: {},
                create: details,
              },
            }
          : {}),
      },
      include: { details: true },
    })

    return successResponse(bom)
  } catch (error) {
    return handleApiError(error)
  }
}
