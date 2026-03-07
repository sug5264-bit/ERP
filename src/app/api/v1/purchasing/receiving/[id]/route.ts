import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params
    const body = await request.json()

    const receiving = await prisma.receiving.update({
      where: { id },
      data: body,
    })

    return successResponse(receiving)
  } catch (error) {
    return handleApiError(error)
  }
}
