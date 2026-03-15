import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, errorResponse } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { session } = authResult
    const roles = session.user.roles || []
    if (!roles.includes('SYSTEM_ADMIN') && !roles.includes('관리자')) {
      return errorResponse('관리자 권한이 필요합니다.', 'FORBIDDEN', 403)
    }

    const body = await request.json()
    const targets = body.targets as string[] | undefined

    const result: Record<string, number> = {}

    await prisma.$transaction(async (tx) => {
      // 수주 관련 전체 삭제
      if (!targets || targets.includes('salesOrders')) {
        // 모든 수주 ID 가져오기
        const orders = await tx.salesOrder.findMany({ select: { id: true } })
        const orderIds = orders.map((o) => o.id)

        if (orderIds.length > 0) {
          // 수주에 연결된 노트 정리
          const salesNotes = await tx.note.findMany({
            where: { relatedTable: 'SalesOrder' },
            select: { id: true },
          })
          const salesNoteIds = salesNotes.map((n) => n.id)

          if (salesNoteIds.length > 0) {
            const deliveryPosts = await tx.note.findMany({
              where: { relatedTable: 'DeliveryPost', relatedId: { in: salesNoteIds } },
              select: { id: true },
            })
            const dpIds = deliveryPosts.map((n) => n.id)

            if (dpIds.length > 0) {
              const r1 = await tx.note.deleteMany({
                where: { relatedTable: 'DeliveryPostStatus', relatedId: { in: dpIds } },
              })
              result.deliveryPostStatuses = r1.count
              const r2 = await tx.note.deleteMany({
                where: { relatedTable: 'DeliveryReply', relatedId: { in: dpIds } },
              })
              result.deliveryReplies = r2.count
              const r3 = await tx.note.deleteMany({
                where: { relatedTable: 'NoteAttachment', relatedId: { in: dpIds } },
              })
              result.deliveryAttachments = r3.count
            }
            const r4 = await tx.note.deleteMany({
              where: { relatedTable: 'DeliveryPost', relatedId: { in: salesNoteIds } },
            })
            result.deliveryPosts = r4.count
            const r5 = await tx.note.deleteMany({
              where: { relatedTable: 'NoteAttachment', relatedId: { in: salesNoteIds } },
            })
            result.salesNoteAttachments = r5.count
            const r6 = await tx.note.deleteMany({
              where: { relatedTable: 'SalesOrder' },
            })
            result.salesNotes = r6.count
          }

          // 납품 관련 정리
          const deliveries = await tx.delivery.findMany({
            where: { salesOrderId: { in: orderIds } },
            select: { id: true },
          })
          if (deliveries.length > 0) {
            const deliveryIds = deliveries.map((d) => d.id)
            // 재고이동 복원
            const stockMovements = await tx.stockMovement.findMany({
              where: { relatedDocType: 'DELIVERY', relatedDocId: { in: deliveryIds } },
              select: { id: true, sourceWarehouseId: true, targetWarehouseId: true },
            })
            if (stockMovements.length > 0) {
              const smIds = stockMovements.map((sm) => sm.id)
              const smDetails = await tx.stockMovementDetail.findMany({
                where: { stockMovementId: { in: smIds } },
                select: { itemId: true, quantity: true, stockMovementId: true },
              })
              const smWarehouseMap = new Map(
                stockMovements.map((sm) => [sm.id, sm.sourceWarehouseId || sm.targetWarehouseId])
              )
              const restoreMap = new Map<string, number>()
              for (const detail of smDetails) {
                const warehouseId = smWarehouseMap.get(detail.stockMovementId)
                if (!warehouseId) continue
                const key = `${detail.itemId}:${warehouseId}`
                restoreMap.set(key, (restoreMap.get(key) || 0) + Number(detail.quantity))
              }
              for (const [key, qty] of restoreMap) {
                const [itemId, warehouseId] = key.split(':')
                await tx.stockBalance.updateMany({
                  where: { itemId, warehouseId },
                  data: { quantity: { increment: qty } },
                })
              }
              await tx.stockMovementDetail.deleteMany({ where: { stockMovementId: { in: smIds } } })
              const r7 = await tx.stockMovement.deleteMany({ where: { id: { in: smIds } } })
              result.stockMovements = r7.count
            }
            await tx.qualityInspectionItem.deleteMany({
              where: { qualityInspection: { deliveryId: { in: deliveryIds } } },
            })
            await tx.qualityInspection.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
            await tx.deliveryDetail.deleteMany({ where: { deliveryId: { in: deliveryIds } } })
            const r8 = await tx.delivery.deleteMany({ where: { salesOrderId: { in: orderIds } } })
            result.deliveries = r8.count
          }

          // 반품 정리
          await tx.salesReturnDetail.deleteMany({
            where: { salesReturn: { salesOrderId: { in: orderIds } } },
          })
          await tx.salesReturn.deleteMany({ where: { salesOrderId: { in: orderIds } } })
          await tx.salesOrderDetail.deleteMany({ where: { salesOrderId: { in: orderIds } } })
          const r9 = await tx.salesOrder.deleteMany({ where: { id: { in: orderIds } } })
          result.salesOrders = r9.count
        }
      }

      // 매출 수기등록 삭제
      if (!targets || targets.includes('salesRevenue')) {
        const r10 = await tx.onlineSalesRevenue.deleteMany({})
        result.salesRevenues = r10.count
      }

      // 견적 삭제
      if (!targets || targets.includes('quotations')) {
        await tx.quotationDetail.deleteMany({})
        const r11 = await tx.quotation.deleteMany({})
        result.quotations = r11.count
      }
    })

    return successResponse({
      message: '데이터가 정리되었습니다.',
      deleted: result,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
