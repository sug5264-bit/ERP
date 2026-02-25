import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

// POST: 발주 일괄 상태 변경
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const { ids, action } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return errorResponse('대상 발주를 선택해주세요.', 'INVALID_INPUT')
    }
    if (ids.length > 100) {
      return errorResponse('한 번에 최대 100건까지 처리 가능합니다.', 'TOO_MANY')
    }

    const orders = await prisma.salesOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, orderNo: true, status: true },
    })

    if (orders.length === 0) {
      return errorResponse('해당 발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    let success = 0
    let failed = 0
    const errors: string[] = []

    if (action === 'cancel') {
      // 취소 가능한 발주 필터
      const cancellable = orders.filter((o) => {
        if (o.status === 'CANCELLED') {
          errors.push(`${o.orderNo}: 이미 취소된 발주입니다.`)
          failed++
          return false
        }
        if (o.status === 'COMPLETED') {
          errors.push(`${o.orderNo}: 완료된 발주는 취소할 수 없습니다.`)
          failed++
          return false
        }
        return true
      })
      // 납품 진행된 발주 제외
      if (cancellable.length > 0) {
        const delivered = await prisma.salesOrderDetail.findMany({
          where: { salesOrderId: { in: cancellable.map((o) => o.id) }, deliveredQty: { gt: 0 } },
          select: { salesOrderId: true },
        })
        const deliveredIds = new Set(delivered.map((d) => d.salesOrderId))
        const orderNoMap = new Map(cancellable.map((o) => [o.id, o.orderNo]))
        const actualCancellable = cancellable.filter((o) => {
          if (deliveredIds.has(o.id)) {
            errors.push(`${o.orderNo}: 납품이 진행된 발주는 취소할 수 없습니다.`)
            failed++
            return false
          }
          return true
        })
        if (actualCancellable.length > 0) {
          try {
            const result = await prisma.salesOrder.updateMany({
              where: { id: { in: actualCancellable.map((o) => o.id) } },
              data: { status: 'CANCELLED' },
            })
            success += result.count
          } catch {
            actualCancellable.forEach((o) => {
              errors.push(`${o.orderNo}: 취소 처리 중 오류 발생`)
              failed++
            })
          }
        }
      }
    } else if (action === 'complete') {
      const dispatchInfo = body.dispatchInfo
      const receivedBy = body.receivedBy
      if (!dispatchInfo || !receivedBy) {
        return errorResponse('일괄 완료 처리를 위해 배차정보와 담당자를 입력해주세요.', 'MISSING_FIELDS')
      }
      const completable = orders.filter((o) => {
        if (o.status === 'COMPLETED') {
          errors.push(`${o.orderNo}: 이미 완료된 발주입니다.`)
          failed++
          return false
        }
        if (o.status === 'CANCELLED') {
          errors.push(`${o.orderNo}: 취소된 발주는 완료 처리할 수 없습니다.`)
          failed++
          return false
        }
        return true
      })
      if (completable.length > 0) {
        try {
          const result = await prisma.salesOrder.updateMany({
            where: { id: { in: completable.map((o) => o.id) } },
            data: { status: 'COMPLETED', dispatchInfo, receivedBy },
          })
          success += result.count
        } catch {
          completable.forEach((o) => {
            errors.push(`${o.orderNo}: 완료 처리 중 오류 발생`)
            failed++
          })
        }
      }
    } else if (action === 'delete') {
      for (const order of orders) {
        try {
          await prisma.$transaction(async (tx) => {
            const deliveries = await tx.delivery.findMany({ where: { salesOrderId: order.id }, select: { id: true } })
            if (deliveries.length > 0) {
              const deliveryIds = deliveries.map((d) => d.id)
              await tx.qualityInspectionItem.deleteMany({
                where: { qualityInspection: { deliveryId: { in: deliveryIds } } },
              })
              await tx.qualityInspection.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
              await tx.deliveryDetail.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
              await tx.delivery.deleteMany({ where: { salesOrderId: order.id } })
            }
            await tx.salesReturnDetail.deleteMany({
              where: { salesReturn: { salesOrderId: order.id } },
            })
            await tx.salesReturn.deleteMany({ where: { salesOrderId: order.id } })
            await tx.salesOrderDetail.deleteMany({ where: { salesOrderId: order.id } })
            await tx.salesOrder.delete({ where: { id: order.id } })
          })
          success++
        } catch {
          errors.push(`${order.orderNo}: 삭제 처리 중 오류 발생`)
          failed++
        }
      }
    } else {
      return errorResponse('지원하지 않는 작업입니다. (cancel, complete, delete)', 'INVALID_ACTION')
    }

    return successResponse({
      total: orders.length,
      success,
      failed,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
