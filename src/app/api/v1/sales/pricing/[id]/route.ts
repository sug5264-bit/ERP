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

export async function PUT(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params
    const body = await request.json()

    const schema = z.object({
      unitPrice: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      minQty: z.number().optional(),
      isActive: z.boolean().optional(),
      remark: z.string().optional(),
    })

    const data = schema.parse(body)

    const existing = await prisma.salesPrice.findUnique({ where: { id } })
    if (!existing) return errorResponse('단가 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const price = await prisma.salesPrice.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    })

    return successResponse(price)
  } catch (error) {
    return handleApiError(error)
  }
}
