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
    const order = await prisma.salesOrder.findUnique({
      where: { id },
      include: {
        partner: true,
        employee: true,
        quotation: true,
        details: { include: { item: true }, orderBy: { lineNo: 'asc' } },
        deliveries: { include: { details: true } },
      },
    })
    if (!order) return errorResponse('수주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    return successResponse(order)
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
    if (body.action === 'complete') {
      const order = await prisma.salesOrder.findUnique({ where: { id } })
      if (!order) return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (order.status === 'COMPLETED') return errorResponse('이미 완료된 발주입니다.', 'INVALID_STATUS')
      if (order.status === 'CANCELLED') return errorResponse('취소된 발주는 완료 처리할 수 없습니다.', 'INVALID_STATUS')

      // 배차정보 및 담당자 확인
      const dispatchInfo = body.dispatchInfo || order.dispatchInfo
      const receivedBy = body.receivedBy || order.receivedBy
      if (!dispatchInfo || !receivedBy) {
        return errorResponse('완료 처리를 위해 배차정보와 발주 담당자를 입력해주세요.', 'MISSING_FIELDS')
      }

      const o = await prisma.salesOrder.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          dispatchInfo: dispatchInfo,
          receivedBy: receivedBy,
        },
      })
      return successResponse(o)
    }
    if (body.action === 'cancel') {
      const order = await prisma.salesOrder.findUnique({ where: { id }, select: { status: true } })
      if (!order) return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (order.status === 'CANCELLED') return errorResponse('이미 취소된 발주입니다.', 'INVALID_STATUS')
      if (order.status === 'COMPLETED') return errorResponse('완료된 발주는 취소할 수 없습니다.', 'INVALID_STATUS')
      // 납품 진행된 발주는 취소 불가
      const hasDelivered = await prisma.salesOrderDetail.findFirst({
        where: { salesOrderId: id, deliveredQty: { gt: 0 } },
      })
      if (hasDelivered) return errorResponse('납품이 진행된 발주는 취소할 수 없습니다.', 'CANNOT_CANCEL')
      const o = await prisma.salesOrder.update({ where: { id }, data: { status: 'CANCELLED' } })
      return successResponse(o)
    }
    // 발주서 수정
    if (body.action === 'update' || (!body.action && body.orderDate)) {
      const order = await prisma.salesOrder.findUnique({ where: { id }, include: { details: true } })
      if (!order) return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
        return errorResponse('완료 또는 취소된 발주는 수정할 수 없습니다.', 'INVALID_STATUS')
      }

      const updateData: Record<string, unknown> = {}
      if (body.orderDate) updateData.orderDate = new Date(body.orderDate)
      if (body.partnerId) updateData.partnerId = body.partnerId
      if (body.deliveryDate !== undefined)
        updateData.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null
      if (body.description !== undefined) updateData.description = body.description
      if (body.vatIncluded !== undefined) updateData.vatIncluded = body.vatIncluded
      if (body.dispatchInfo !== undefined) updateData.dispatchInfo = body.dispatchInfo
      if (body.receivedBy !== undefined) updateData.receivedBy = body.receivedBy

      if (body.details && Array.isArray(body.details)) {
        // 상세 항목 기본 검증
        for (const d of body.details) {
          if (!d.itemId || typeof d.itemId !== 'string') throw new Error('품목 ID가 올바르지 않습니다.')
          if (typeof d.quantity !== 'number' || d.quantity <= 0) throw new Error('수량은 0보다 커야 합니다.')
          if (typeof d.unitPrice !== 'number' || d.unitPrice < 0) throw new Error('단가는 0 이상이어야 합니다.')
        }

        // 기존 납품 수량 보존을 위해 맵 생성
        const existingDelivered = new Map(order.details.map((d) => [d.itemId, Number(d.deliveredQty ?? 0)]))
        // 품목 세금유형 조회
        const orderItemIds = body.details.map((d: { itemId: string }) => d.itemId)
        const itemsInfo = await prisma.item.findMany({
          where: { id: { in: orderItemIds } },
          select: { id: true, taxType: true },
        })
        const taxTypeMap = new Map(itemsInfo.map((i) => [i.id, i.taxType]))
        const isVatIncluded = body.vatIncluded !== undefined ? body.vatIncluded : order.vatIncluded
        const details = body.details.map(
          (d: { itemId: string; quantity: number; unitPrice: number; remark?: string }, idx: number) => {
            const supplyAmount = Math.round(d.quantity * d.unitPrice)
            const taxType = taxTypeMap.get(d.itemId) || 'TAXABLE'
            const taxAmount = isVatIncluded && taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
            const deliveredQty = existingDelivered.get(d.itemId) || 0
            const remainingQty = Math.max(0, d.quantity - deliveredQty)
            return {
              lineNo: idx + 1,
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              supplyAmount,
              taxAmount,
              totalAmount: supplyAmount + taxAmount,
              deliveredQty,
              remainingQty,
              remark: d.remark || null,
            }
          }
        )
        const totalSupply = details.reduce((s: number, d: { supplyAmount: number }) => s + d.supplyAmount, 0)
        const totalTax = details.reduce((s: number, d: { taxAmount: number }) => s + d.taxAmount, 0)
        updateData.totalSupply = totalSupply
        updateData.totalTax = totalTax
        updateData.totalAmount = totalSupply + totalTax

        await prisma.$transaction(async (tx) => {
          await tx.salesOrderDetail.deleteMany({ where: { salesOrderId: id } })
          await tx.salesOrderDetail.createMany({
            data: details.map((d: Record<string, unknown>) => ({ ...d, salesOrderId: id })),
          })
          await tx.salesOrder.update({ where: { id }, data: updateData })
        })
      } else {
        await prisma.salesOrder.update({ where: { id }, data: updateData })
      }

      const updated = await prisma.salesOrder.findUnique({
        where: { id },
        include: { partner: true, details: { include: { item: true } } },
      })
      return successResponse(updated)
    }
    return errorResponse('지원하지 않는 작업입니다.', 'INVALID_ACTION')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'delete')
    if (isErrorResponse(authResult)) return authResult
    const { id } = await params

    const order = await prisma.salesOrder.findUnique({ where: { id } })
    if (!order) return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // 완료된 발주는 삭제 불가 (재고/회계 정합성 보호)
    if (order.status === 'COMPLETED') {
      return errorResponse('완료된 발주는 삭제할 수 없습니다. 먼저 반품 처리를 진행하세요.', 'INVALID_STATUS', 400)
    }

    await prisma.$transaction(async (tx) => {
      const deliveries = await tx.delivery.findMany({ where: { salesOrderId: id }, select: { id: true } })
      if (deliveries.length > 0) {
        const deliveryIds = deliveries.map((d) => d.id)
        // 품질검사 관련 데이터 먼저 삭제 (FK 제약조건)
        await tx.qualityInspectionItem.deleteMany({
          where: { qualityInspection: { deliveryId: { in: deliveryIds } } },
        })
        await tx.qualityInspection.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
        // 재고이동 관련 데이터 삭제 (납품에 연결된 StockMovement)
        const stockMovements = await tx.stockMovement.findMany({
          where: { relatedDocType: 'DELIVERY', relatedDocId: { in: deliveryIds } },
          select: { id: true },
        })
        if (stockMovements.length > 0) {
          const smIds = stockMovements.map((sm) => sm.id)
          await tx.stockMovementDetail.deleteMany({ where: { stockMovementId: { in: smIds } } })
          await tx.stockMovement.deleteMany({ where: { id: { in: smIds } } })
        }
        await tx.deliveryDetail.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
        await tx.delivery.deleteMany({ where: { salesOrderId: id } })
      }
      // 반품 관련 데이터 삭제
      await tx.salesReturnDetail.deleteMany({
        where: { salesReturn: { salesOrderId: id } },
      })
      await tx.salesReturn.deleteMany({ where: { salesOrderId: id } })
      await tx.salesOrderDetail.deleteMany({ where: { salesOrderId: id } })
      await tx.salesOrder.delete({ where: { id } })
    })

    return successResponse({ message: '발주가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
