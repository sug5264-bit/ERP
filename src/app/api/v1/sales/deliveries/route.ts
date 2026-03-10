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
import { ensureItemExists } from '@/lib/auto-sync'

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
    // 수주/출하 추적 필터
    const orderConfirmed = sp.get('orderConfirmed')
    if (orderConfirmed === 'true') where.orderConfirmed = true
    else if (orderConfirmed === 'false') where.orderConfirmed = false
    const shipmentCompleted = sp.get('shipmentCompleted')
    if (shipmentCompleted === 'true') where.shipmentCompleted = true
    else if (shipmentCompleted === 'false') where.shipmentCompleted = false
    // 날짜 필터
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      const dateRange: { gte?: Date; lte?: Date } = {}
      if (startDate) {
        const d = new Date(startDate)
        if (!isNaN(d.getTime())) dateRange.gte = d
      }
      if (endDate) {
        const d = new Date(endDate)
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999)
          dateRange.lte = d
        }
      }
      where.deliveryDate = dateRange
    }
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
            include: {
              item: {
                select: { id: true, itemName: true, specification: true, barcode: true, unit: true, itemCode: true },
              },
            },
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
    if (!salesOrder) return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (salesOrder.status === 'CANCELLED')
      return errorResponse('취소된 발주에는 납품을 생성할 수 없습니다.', 'INVALID_STATUS', 400)
    if (salesOrder.status === 'COMPLETED') return errorResponse('이미 완료된 발주입니다.', 'INVALID_STATUS', 400)
    if (!salesOrder.partnerId) return errorResponse('발주에 거래처가 지정되지 않았습니다.', 'MISSING_PARTNER', 400)

    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    const autoCreated: string[] = []
    const result = await prisma.$transaction(async (tx) => {
      // 품목 자동 생성/확인
      const resolvedDetails = []
      for (const d of data.details) {
        const itemId = await ensureItemExists(
          {
            itemId: d.itemId,
            itemCode: d.itemCode,
            itemName: d.itemName,
            standardPrice: d.unitPrice,
          },
          tx
        )
        if (!d.itemId && d.itemName) {
          autoCreated.push(`품목 "${d.itemName}" 자동 생성`)
        }
        resolvedDetails.push({ ...d, itemId })
      }

      // 납품 수량이 발주 잔량을 초과하는지 검증
      const salesOrderDetails = await tx.salesOrderDetail.findMany({
        where: { salesOrderId: data.salesOrderId },
        select: { itemId: true, remainingQty: true },
      })
      for (const detail of resolvedDetails) {
        const orderDetail = salesOrderDetails.find((sod) => sod.itemId === detail.itemId)
        if (!orderDetail) {
          throw new Error(`발주에 포함되지 않은 품목입니다. (itemId: ${detail.itemId})`)
        }
        if (detail.quantity > Number(orderDetail.remainingQty)) {
          throw new Error(
            `납품 수량이 발주 잔량을 초과합니다. (품목: ${detail.itemId}, 잔량: ${orderDetail.remainingQty}, 납품수량: ${detail.quantity})`
          )
        }
      }

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
            create: resolvedDetails.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              amount: Math.round(d.quantity * d.unitPrice),
            })),
          },
        },
        include: { details: { include: { item: true } }, partner: true, salesOrder: true },
      })

      // 발주 상세 업데이트 (납품수량 증가, 잔량 감소)
      await Promise.all(
        resolvedDetails.map((d) =>
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
            create: resolvedDetails.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              amount: Math.round(d.quantity * d.unitPrice),
            })),
          },
        },
      })

      // 재고 잔량 차감 (창고별 순차 차감, 음수 방지 검증)
      for (const d of resolvedDetails) {
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
        // 재고가 많은 창고부터 순차 차감 (낙관적 잠금으로 동시성 보호)
        let remaining = d.quantity
        for (const bal of balances) {
          if (remaining <= 0) break
          const available = Number(bal.quantity)
          const deduct = Math.min(available, remaining)
          if (deduct > 0) {
            const result = await tx.stockBalance.updateMany({
              where: { id: bal.id, quantity: { gte: deduct } },
              data: { quantity: { decrement: deduct } },
            })
            if (result.count === 0) {
              const item = await tx.item.findUnique({ where: { id: d.itemId }, select: { itemName: true } })
              throw new Error(
                `품목 "${item?.itemName || d.itemId}"의 재고가 동시 처리로 변경되었습니다. 다시 시도해주세요.`
              )
            }
            remaining -= deduct
          }
        }
      }

      // 발주 전체 납품 완료 시 상태 자동 변경
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
    return successResponse({ ...result, autoCreated })
  } catch (error) {
    return handleApiError(error)
  }
}
