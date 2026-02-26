import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await req.json()

    const validStatuses = ['REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED']
    if (!body.status || !validStatuses.includes(body.status)) {
      return errorResponse('유효하지 않은 상태값입니다.', 'INVALID_STATUS', 400)
    }

    const existing = await prisma.salesReturn.findUnique({ where: { id } })
    if (!existing) return errorResponse('반품을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // 상태 전이 규칙: 허용된 전환만 가능
    const allowedTransitions: Record<string, string[]> = {
      REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
      APPROVED: ['COMPLETED', 'CANCELLED'],
      REJECTED: ['REQUESTED'],
    }
    const allowed = allowedTransitions[existing.status]
    if (!allowed || !allowed.includes(body.status)) {
      return errorResponse(
        `${existing.status} 상태에서 ${body.status}(으)로 변경할 수 없습니다.`,
        'INVALID_TRANSITION',
        400
      )
    }

    const salesReturn = await prisma.salesReturn.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.status === 'COMPLETED' || body.status === 'APPROVED'
          ? { processedAt: new Date(), processedBy: authResult.session.user?.id || null }
          : {}),
      },
    })

    return successResponse(salesReturn)
  } catch (error) {
    return handleApiError(error)
  }
}
