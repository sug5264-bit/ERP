import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      include: { _count: { select: { posts: true } } },
      orderBy: { boardCode: 'asc' },
    })
    return successResponse(boards, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) { return handleApiError(error) }
}
