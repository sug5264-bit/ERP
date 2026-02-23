import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const authResult = await requirePermissionCheck('board', 'read')
    if (isErrorResponse(authResult)) return authResult
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      include: { _count: { select: { posts: true } } },
      orderBy: { boardCode: 'asc' },
    })
    return successResponse(boards, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}
