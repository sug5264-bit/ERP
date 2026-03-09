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
import { createReceivingSchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'
import { ensureItemExists, createAutoStockMovement } from '@/lib/auto-sync'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.receivingDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [items, totalCount] = await Promise.all([
      prisma.receiving.findMany({
        where,
        include: {
          purchaseOrder: { select: { orderNo: true } },
          partner: { select: { partnerName: true } },
          details: {
            include: { item: { select: { id: true, itemName: true, itemCode: true } } },
          },
        },
        orderBy: { receivingDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.receiving.count({ where }),
    ])

    const data = items.map((r) => ({
      id: r.id,
      receivingNo: r.receivingNo,
      receivingDate: r.receivingDate,
      orderNo: r.purchaseOrder?.orderNo || '-',
      supplierName: r.partner?.partnerName || '-',
      status: r.status,
      inspectorName: r.inspectedBy || '-',
      details: r.details,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createReceivingSchema.parse(body)

    // 구매발주 확인
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      select: { id: true, partnerId: true, status: true },
    })
    if (!purchaseOrder) return errorResponse('구매발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (purchaseOrder.status === 'CANCELLED')
      return errorResponse('취소된 구매발주에는 입고를 생성할 수 없습니다.', 'INVALID_STATUS', 400)
    if (purchaseOrder.status === 'COMPLETED') return errorResponse('이미 완료된 구매발주입니다.', 'INVALID_STATUS', 400)

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

      // 입고 수량이 발주 잔량을 초과하는지 검증
      const poDetails = await tx.purchaseOrderDetail.findMany({
        where: { purchaseOrderId: data.purchaseOrderId },
        select: { itemId: true, remainingQty: true, unitPrice: true },
      })
      for (const detail of resolvedDetails) {
        const poDetail = poDetails.find((pod) => pod.itemId === detail.itemId)
        if (!poDetail) {
          throw new Error(`구매발주에 포함되지 않은 품목입니다. (itemId: ${detail.itemId})`)
        }
        if (detail.quantity > Number(poDetail.remainingQty)) {
          throw new Error(
            `입고 수량이 발주 잔량을 초과합니다. (품목: ${detail.itemId}, 잔량: ${poDetail.remainingQty}, 입고수량: ${detail.quantity})`
          )
        }
      }

      // 입고 생성
      const receivingNo = await generateDocumentNumber('RCV', new Date(data.receivingDate), tx)
      const receiving = await tx.receiving.create({
        data: {
          receivingNo,
          receivingDate: new Date(data.receivingDate),
          purchaseOrderId: data.purchaseOrderId,
          partnerId: purchaseOrder.partnerId,
          details: {
            create: resolvedDetails.map((d) => ({
              itemId: d.itemId,
              orderedQty: d.quantity,
              receivedQty: d.quantity,
              acceptedQty: d.quantity,
              rejectedQty: 0,
              unitPrice: d.unitPrice,
              amount: Math.round(d.quantity * d.unitPrice),
            })),
          },
        },
        include: {
          details: { include: { item: { select: { id: true, itemName: true } } } },
          partner: { select: { partnerName: true } },
          purchaseOrder: { select: { orderNo: true } },
        },
      })

      // 구매발주 상세 업데이트 (입고수량 증가, 잔량 감소)
      await Promise.all(
        resolvedDetails.map((d) =>
          tx.purchaseOrderDetail.updateMany({
            where: { purchaseOrderId: data.purchaseOrderId, itemId: d.itemId },
            data: { receivedQty: { increment: d.quantity }, remainingQty: { decrement: d.quantity } },
          })
        )
      )

      // 재고이동 자동 생성 (입고)
      await createAutoStockMovement(
        {
          movementType: 'INBOUND',
          relatedDocType: 'RECEIVING',
          relatedDocId: receiving.id,
          movementDate: new Date(data.receivingDate),
          details: resolvedDetails.map((d) => ({
            itemId: d.itemId,
            quantity: d.quantity,
            unitPrice: d.unitPrice,
            lotNo: d.lotNo || null,
            expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
          })),
          createdBy: employee.id,
          warehouseId: data.warehouseId || null,
        },
        tx
      )

      // 구매발주 전체 입고 완료 시 상태 자동 변경
      const remainingDetails = await tx.purchaseOrderDetail.findMany({
        where: { purchaseOrderId: data.purchaseOrderId, remainingQty: { gt: 0 } },
      })
      if (remainingDetails.length === 0) {
        await tx.purchaseOrder.update({
          where: { id: data.purchaseOrderId },
          data: { status: 'COMPLETED' },
        })
      } else {
        await tx.purchaseOrder.update({
          where: { id: data.purchaseOrderId },
          data: { status: 'IN_PROGRESS' },
        })
      }

      return receiving
    })

    return successResponse({ ...result, autoCreated })
  } catch (error) {
    return handleApiError(error)
  }
}
