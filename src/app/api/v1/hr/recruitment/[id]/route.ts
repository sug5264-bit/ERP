import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params

    const recruitment = await prisma.recruitment.findUnique({
      where: { id },
      include: {
        applicants: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!recruitment) {
      return errorResponse('채용공고를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    return successResponse(recruitment)
  } catch (error) {
    return handleApiError(error)
  }
}
