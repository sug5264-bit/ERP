import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession } from '@/lib/api-helpers'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const templates = await prisma.approvalTemplate.findMany({
      where: { isActive: true },
      include: { approvalLines: { orderBy: { lineOrder: 'asc' } } },
      orderBy: { templateName: 'asc' },
    })
    return successResponse(templates)
  } catch (error) { return handleApiError(error) }
}
