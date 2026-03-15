import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipperId: true, accountType: true },
    })

    if (!user?.shipperId || user.accountType !== 'SHIPPER') {
      return errorResponse('화주사 계정이 아닙니다.', 'FORBIDDEN', 403)
    }

    const shipperId = user.shipperId
    const { id } = await params

    const order = await prisma.shipperOrder.findUnique({
      where: { id },
      include: {
        shipperItem: true,
      },
    })

    if (!order) {
      return errorResponse('주문을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    if (order.shipperId !== shipperId) {
      return errorResponse('접근 권한이 없습니다.', 'FORBIDDEN', 403)
    }

    return successResponse(order)
  } catch (error) {
    return handleApiError(error)
  }
}
