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
    const authResult = await requirePermissionCheck('purchasing', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        partner: {
          select: {
            partnerName: true,
            bizNo: true,
            ceoName: true,
            address: true,
            phone: true,
            bizType: true,
            bizCategory: true,
          },
        },
        employee: { select: { nameKo: true } },
        details: {
          include: {
            item: { select: { itemName: true, specification: true, unit: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
      },
    })

    if (!order) {
      return errorResponse('발주서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    return successResponse(order)
  } catch (error) {
    return handleApiError(error)
  }
}
