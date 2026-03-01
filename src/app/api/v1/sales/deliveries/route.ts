import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createDeliverySchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status
    const salesChannel = sp.get('salesChannel')
    if (salesChannel) where.salesOrder = { salesChannel }
    const [items, totalCount] = await Promise.all([
      prisma.delivery.findMany({
        where,
        include: {
          salesOrder: { select: { id: true, orderNo: true, orderDate: true, status: true, salesChannel: true } },
          partner: {
            select: {
              id: true,
              partnerCode: true,
              partnerName: true,
              bizNo: true,
              ceoName: true,
              address: true,
              phone: true,
            },
          },
          details: {
            include: { item: { select: { id: true, itemName: true, specification: true, barcode: true, unit: true } } },
          },
          qualityInspections: {
            select: {
              id: true,
              inspectionNo: true,
              overallGrade: true,
              judgement: true,
              defectRate: true,
              status: true,
              inspectionDate: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.delivery.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult
    const body = await request.json()
    const data = createDeliverySchema.parse(body)

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      select: { id: true, partnerId: true, status: true },
    })
    if (!salesOrder) return errorResponse('수주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (salesOrder.status === 'CANCELLED')
      return errorResponse('취소된 수주에는 납품을 생성할 수 없습니다.', 'INVALID_STATUS', 400)
    if (salesOrder.status === 'COMPLETED') return errorResponse('이미 완료된 수주입니다.', 'INVALID_STATUS', 400)
    if (!salesOrder.partnerId) return errorResponse('수주에 거래처가 지정되지 않았습니다.', 'MISSING_PARTNER', 400)

    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    const result = await prisma.$transaction(async (tx) => {
      const deliveryNo = await generateDocumentNumber('DLV', new Date(data.deliveryDate), tx)
      const delivery = await tx.delivery.create({
        data: {
          deliveryNo,
          deliveryDate: new Date(data.deliveryDate),
          salesOrderId: data.salesOrderId,
          partnerId: salesOrder.partnerId!,
          deliveryAddress: data.deliveryAddress || null,
          trackingNo: data.trackingNo || null,
          carrier: data.carrier || null,
          details: {
            create: data.details.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              amount: Math.round(d.quantity * d.unitPrice),
            })),
          },
        },
        include: { details: { include: { item: true } }, partner: true, salesOrder: true },
      })

      // 수주 상세 업데이트 (납품수량 증가, 잔량 감소)
      await Promise.all(
        data.details.map((d) =>
          tx.salesOrderDetail.updateMany({
            where: { salesOrderId: data.salesOrderId, itemId: d.itemId },
            data: { deliveredQty: { increment: d.quantity }, remainingQty: { decrement: d.quantity } },
          })
        )
      )

      // 재고이동 자동 생성 (출고)
      const movementNo = await generateDocumentNumber('SM', new Date(data.deliveryDate), tx)
      await tx.stockMovement.create({
        data: {
          movementNo,
          movementDate: new Date(data.deliveryDate),
          movementType: 'OUTBOUND',
          relatedDocType: 'DELIVERY',
          relatedDocId: delivery.id,
          createdBy: employee.id,
          details: {
            create: data.details.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              amount: Math.round(d.quantity * d.unitPrice),
            })),
          },
        },
      })

      // 재고 잔량 차감 (창고별 순차 차감, 음수 방지 검증)
      for (const d of data.details) {
        const balances = await tx.stockBalance.findMany({
          where: { itemId: d.itemId },
          select: { id: true, quantity: true, warehouseId: true },
          orderBy: { quantity: 'desc' },
        })
        const totalStock = balances.reduce((sum, b) => sum + Number(b.quantity), 0)
        if (totalStock < d.quantity) {
          const item = await tx.item.findUnique({ where: { id: d.itemId }, select: { itemName: true } })
          throw new Error(
            `품목 "${item?.itemName || d.itemId}"의 재고가 부족합니다. (현재고: ${totalStock}, 출고량: ${d.quantity})`
          )
        }
        // 재고가 많은 창고부터 순차 차감
        let remaining = d.quantity
        for (const bal of balances) {
          if (remaining <= 0) break
          const available = Number(bal.quantity)
          const deduct = Math.min(available, remaining)
          if (deduct > 0) {
            await tx.stockBalance.update({
              where: { id: bal.id },
              data: { quantity: { decrement: deduct } },
            })
            remaining -= deduct
          }
        }
      }

      // 수주 전체 납품 완료 시 상태 자동 변경
      const remainingDetails = await tx.salesOrderDetail.findMany({
        where: { salesOrderId: data.salesOrderId, remainingQty: { gt: 0 } },
      })
      if (remainingDetails.length === 0) {
        await tx.salesOrder.update({
          where: { id: data.salesOrderId },
          data: { status: 'COMPLETED' },
        })
      } else {
        await tx.salesOrder.update({
          where: { id: data.salesOrderId },
          data: { status: 'IN_PROGRESS' },
        })
      }

      return delivery
    })
    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
