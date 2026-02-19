import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    })

    return successResponse(permissions)
  } catch (error) {
    return handleApiError(error)
  }
}
