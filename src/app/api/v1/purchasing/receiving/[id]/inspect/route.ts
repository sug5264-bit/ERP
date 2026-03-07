import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params

    const receiving = await prisma.receiving.findUnique({ where: { id } })
    if (!receiving) return errorResponse('입고 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const updated = await prisma.receiving.update({
      where: { id },
      data: { status: 'INSPECTED' },
    })

    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
