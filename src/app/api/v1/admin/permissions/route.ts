import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
      take: 500,
    })

    return successResponse(permissions)
  } catch (error) {
    return handleApiError(error)
  }
}
