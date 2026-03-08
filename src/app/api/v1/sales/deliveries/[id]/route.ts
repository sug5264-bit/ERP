import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: {
        salesOrder: { select: { id: true, orderNo: true, orderDate: true, status: true, salesChannel: true } },
        partner: true,
        details: {
          include: { item: { select: { id: true, itemName: true, specification: true, barcode: true, unit: true } } },
          orderBy: { id: 'asc' },
        },
        qualityInspections: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!delivery) return errorResponse('납품을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(delivery)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) return errorResponse('납품을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    const updated = await prisma.delivery.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.completedAt && { completedAt: new Date(body.completedAt) }),
        ...(body.deliveryDate && { deliveryDate: new Date(body.deliveryDate) }),
        ...(body.memo !== undefined && { memo: body.memo }),
      },
    })
    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const body = await request.json()
    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) return errorResponse('납품을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.completedAt) updateData.completedAt = new Date(body.completedAt)
    // 수주 확인 체크
    if (body.orderConfirmed !== undefined) {
      updateData.orderConfirmed = body.orderConfirmed
      if (body.orderConfirmed) updateData.orderConfirmedAt = new Date()
      else updateData.orderConfirmedAt = null
    }
    // 출하 완료 체크
    if (body.shipmentCompleted !== undefined) {
      updateData.shipmentCompleted = body.shipmentCompleted
      if (body.shipmentCompleted) updateData.shipmentCompletedAt = new Date()
      else updateData.shipmentCompletedAt = null
    }
    // 온라인 매출 관련
    if (body.actualRevenue !== undefined) updateData.actualRevenue = body.actualRevenue
    if (body.platformFee !== undefined) updateData.platformFee = body.platformFee
    if (body.revenueNote !== undefined) updateData.revenueNote = body.revenueNote
    const updated = await prisma.delivery.update({
      where: { id },
      data: updateData,
    })
    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'delete')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params
    const delivery = await prisma.delivery.findUnique({ where: { id } })
    if (!delivery) return errorResponse('납품을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    await prisma.delivery.delete({ where: { id } })
    return successResponse({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
