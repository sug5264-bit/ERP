import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

const VALID_STATUSES = ['PREPARING', 'SHIPPED', 'DELIVERED']

/** 허용되는 상태 전이 (현재 → 다음) */
const VALID_TRANSITIONS: Record<string, string[]> = {
  PREPARING: ['SHIPPED', 'DELIVERED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
}

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
          include: { item: { select: { id: true, itemName: true, specification: true, barcode: true, unit: true, itemCode: true } } },
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
    // 상태값 유효성 검증
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return errorResponse(`유효하지 않은 상태값입니다: ${body.status}`, 'VALIDATION_ERROR', 400)
    }
    // 상태 전이 검증
    if (body.status && body.status !== delivery.status) {
      const allowed = VALID_TRANSITIONS[delivery.status] || []
      if (!allowed.includes(body.status)) {
        return errorResponse(
          `${delivery.status}에서 ${body.status}(으)로 변경할 수 없습니다.`,
          'INVALID_TRANSITION',
          400
        )
      }
    }
    const updated = await prisma.delivery.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.completedAt && { completedAt: new Date(body.completedAt) }),
        ...(body.deliveryDate && { deliveryDate: new Date(body.deliveryDate) }),
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
    // 상태값 유효성 검증
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return errorResponse(`유효하지 않은 상태값입니다: ${body.status}`, 'VALIDATION_ERROR', 400)
    }
    // 상태 전이 검증
    if (body.status && body.status !== delivery.status) {
      const allowed = VALID_TRANSITIONS[delivery.status] || []
      if (!allowed.includes(body.status)) {
        return errorResponse(
          `${delivery.status}에서 ${body.status}(으)로 변경할 수 없습니다.`,
          'INVALID_TRANSITION',
          400
        )
      }
    }
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
    const delivery = await prisma.delivery.findUnique({
      where: { id },
      include: { details: true },
    })
    if (!delivery) return errorResponse('납품을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    // 출하완료된 납품은 삭제 불가
    if (delivery.status === 'SHIPPED' || delivery.status === 'DELIVERED') {
      return errorResponse(
        '출하완료 또는 납품완료된 건은 삭제할 수 없습니다. 반품 처리를 이용해 주세요.',
        'INVALID_STATUS',
        400
      )
    }

    await prisma.$transaction(async (tx) => {
      // 1. 발주 상세 납품수량 복원 (잔량 증가)
      await Promise.all(
        delivery.details.map((d) =>
          tx.salesOrderDetail.updateMany({
            where: { salesOrderId: delivery.salesOrderId, itemId: d.itemId },
            data: {
              deliveredQty: { decrement: Number(d.quantity) },
              remainingQty: { increment: Number(d.quantity) },
            },
          })
        )
      )

      // 2. 재고 잔량 복원 (출고 시 재고가 많은 창고에서 차감했으므로 동일 기준으로 복원)
      for (const d of delivery.details) {
        const balances = await tx.stockBalance.findMany({
          where: { itemId: d.itemId },
          select: { id: true },
          orderBy: { quantity: 'desc' },
          take: 1,
        })
        if (balances.length > 0) {
          await tx.stockBalance.update({
            where: { id: balances[0].id },
            data: { quantity: { increment: Number(d.quantity) } },
          })
        }
      }

      // 3. 관련 재고이동 삭제
      await tx.stockMovementDetail.deleteMany({
        where: {
          stockMovement: { relatedDocType: 'DELIVERY', relatedDocId: id },
        },
      })
      await tx.stockMovement.deleteMany({
        where: { relatedDocType: 'DELIVERY', relatedDocId: id },
      })

      // 4. 발주 상태 복원 (잔여 품목이 있으면 IN_PROGRESS, 없으면 ORDERED)
      const remainingDetails = await tx.salesOrderDetail.findMany({
        where: { salesOrderId: delivery.salesOrderId },
        select: { remainingQty: true, deliveredQty: true },
      })
      const hasDelivered = remainingDetails.some((d) => Number(d.deliveredQty) > 0)
      await tx.salesOrder.update({
        where: { id: delivery.salesOrderId },
        data: { status: hasDelivered ? 'IN_PROGRESS' : 'ORDERED' },
      })

      // 5. 납품 삭제 (DeliveryDetail은 onDelete: Cascade로 자동 삭제)
      await tx.delivery.delete({ where: { id } })
    })

    return successResponse({ id })
  } catch (error) {
    return handleApiError(error)
  }
}
