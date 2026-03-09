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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse('발주서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    const VALID_STATUSES = ['ORDERED', 'CONFIRMED', 'SHIPPED', 'RECEIVED', 'CANCELLED']
    const updateData: Record<string, unknown> = {}
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return errorResponse('유효하지 않은 상태입니다.', 'INVALID_STATUS', 400)
      }
      updateData.status = body.status
    }
    if (body.deliveryDate) updateData.deliveryDate = new Date(body.deliveryDate)
    if (body.description !== undefined) updateData.description = body.description

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        partner: { select: { partnerName: true } },
        details: { include: { item: { select: { itemName: true } } } },
      },
    })

    return successResponse(order)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const existing = await prisma.purchaseOrder.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse('발주서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }
    if (existing.status !== 'ORDERED') {
      return errorResponse('발주완료 상태의 발주서만 삭제할 수 있습니다.', 'INVALID_STATUS', 400)
    }

    await prisma.purchaseOrder.delete({ where: { id } })
    return successResponse({ message: '발주서가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
