import { NextRequest } from 'next/server'
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

    const years = await prisma.fiscalYear.findMany({
      include: {
        _count: { select: { vouchers: true } },
      },
      orderBy: { year: 'desc' },
    })

    return successResponse(years)
  } catch (error) {
    return handleApiError(error)
  }
}
