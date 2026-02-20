import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const body = await req.json()

    const salesReturn = await prisma.salesReturn.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.status === 'COMPLETED' || body.status === 'APPROVED'
          ? { processedAt: new Date(), processedBy: session.user?.id || null }
          : {}),
      },
    })

    return successResponse(salesReturn)
  } catch (error) {
    return handleApiError(error)
  }
}
