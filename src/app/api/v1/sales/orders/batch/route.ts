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
              where: { id: { in: actualCancellable.map((o) => o.id) }, status: { notIn: ['CANCELLED', 'COMPLETED'] } },
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
            where: { id: { in: completable.map((o) => o.id) }, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
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
      // 삭제는 별도 권한 체크
      const deleteAuth = await requirePermissionCheck('sales', 'delete')
      if (isErrorResponse(deleteAuth)) return deleteAuth

      for (const order of orders) {
        if (order.status === 'COMPLETED') {
          errors.push(`${order.orderNo}: 완료된 발주는 삭제할 수 없습니다.`)
          failed++
          continue
        }
        try {
          await prisma.$transaction(async (tx) => {
            const deliveries = await tx.delivery.findMany({ where: { salesOrderId: order.id }, select: { id: true } })
            if (deliveries.length > 0) {
              const deliveryIds = deliveries.map((d) => d.id)
              await tx.qualityInspectionItem.deleteMany({
                where: { qualityInspection: { deliveryId: { in: deliveryIds } } },
              })
              await tx.qualityInspection.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
              // 재고이동 관련 데이터 삭제 (재고 잔량 복원 후 삭제)
              const stockMovements = await tx.stockMovement.findMany({
                where: { relatedDocType: 'DELIVERY', relatedDocId: { in: deliveryIds } },
                select: { id: true, movementType: true },
              })
              if (stockMovements.length > 0) {
                const smIds = stockMovements.map((sm) => sm.id)
                // 출고된 재고를 복원
                const smDetails = await tx.stockMovementDetail.findMany({
                  where: { stockMovementId: { in: smIds } },
                  select: { itemId: true, quantity: true },
                })
                for (const detail of smDetails) {
                  const balance = await tx.stockBalance.findFirst({
                    where: { itemId: detail.itemId },
                    orderBy: { lastMovementDate: 'desc' },
                  })
                  if (balance) {
                    await tx.stockBalance.update({
                      where: { id: balance.id },
                      data: { quantity: { increment: Number(detail.quantity) }, lastMovementDate: new Date() },
                    })
                  }
                }
                await tx.stockMovementDetail.deleteMany({ where: { stockMovementId: { in: smIds } } })
                await tx.stockMovement.deleteMany({ where: { id: { in: smIds } } })
              }
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
        } catch (err) {
          const detail = err instanceof Error ? err.message : ''
          errors.push(`${order.orderNo}: 삭제 처리 중 오류${detail ? ` - ${detail}` : ''}`)
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
