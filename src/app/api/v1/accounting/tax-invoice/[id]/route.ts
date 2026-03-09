import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const invoice = await prisma.taxInvoice.findUnique({
      where: { id },
      include: {
        partner: { select: { partnerName: true } },
        items: { orderBy: { itemDate: 'asc' } },
      },
    })

    if (!invoice) {
      return errorResponse('세금계산서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    return successResponse(invoice)
  } catch (error) {
    return handleApiError(error)
  }
}
