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
import { createSalesReturnSchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'
import { ensureItemExists, ensurePartnerExists, createAutoStockMovement } from '@/lib/auto-sync'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = req.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status

    const [items, totalCount] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        include: {
          salesOrder: { select: { id: true, orderNo: true } },
          partner: { select: { id: true, partnerName: true } },
          details: { include: { item: { select: { id: true, itemName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.salesReturn.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const data = createSalesReturnSchema.parse(body)

    // 발주 존재 확인
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      select: { id: true, partnerId: true, status: true },
    })
    if (!salesOrder) {
      return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const autoCreated: string[] = []

    const salesReturn = await prisma.$transaction(async (tx) => {
      // 거래처 자동 확인/생성
      const partnerId = await ensurePartnerExists(
        {
          partnerId: data.partnerId || salesOrder.partnerId,
          partnerName: data.partnerName,
          partnerType: 'SALES',
        },
        tx
      )

      if (salesOrder.partnerId && partnerId && salesOrder.partnerId !== partnerId) {
        throw new Error('반품 거래처가 발주 거래처와 일치하지 않습니다.')
      }
      const finalPartnerId = partnerId || salesOrder.partnerId
      if (!finalPartnerId) {
        throw new Error('거래처 정보가 필요합니다.')
      }

      // 반품 상세 품목 자동 생성/확인
      const rawDetails = data.details || []
      const resolvedDetails = []
      for (const d of rawDetails) {
        const itemId = await ensureItemExists(
          {
            itemId: d.itemId,
            itemCode: d.itemCode,
            itemName: d.itemName,
          },
          tx
        )
        if (!d.itemId && d.itemName) {
          autoCreated.push(`품목 "${d.itemName}" 자동 생성`)
        }
        resolvedDetails.push({ ...d, itemId })
      }

      const computedTotal =
        resolvedDetails.length > 0
          ? resolvedDetails.reduce((sum, d) => sum + Math.round(d.quantity * d.unitPrice), 0)
          : data.totalAmount

      const returnNo = await generateDocumentNumber('RT', new Date(data.returnDate), tx)
      const created = await tx.salesReturn.create({
        data: {
          returnNo,
          returnDate: new Date(data.returnDate),
          salesOrderId: data.salesOrderId,
          partnerId: finalPartnerId,
          reason: data.reason,
          reasonDetail: data.reasonDetail || null,
          totalAmount: computedTotal,
          ...(resolvedDetails.length > 0 && {
            details: {
              create: resolvedDetails.map((d) => ({
                itemId: d.itemId,
                quantity: d.quantity,
                unitPrice: d.unitPrice,
                amount: Math.round(d.quantity * d.unitPrice),
                remark: d.remark || null,
              })),
            },
          }),
        },
        include: {
          salesOrder: { select: { id: true, orderNo: true } },
          partner: { select: { id: true, partnerName: true } },
          details: { include: { item: { select: { id: true, itemName: true } } } },
        },
      })

      // 반품 시 재고 복원 (입고 처리) 및 발주 잔량 복원
      if (resolvedDetails.length > 0) {
        // 재고이동 자동 생성 (반품 입고)
        await createAutoStockMovement(
          {
            movementType: 'INBOUND',
            relatedDocType: 'SALES_RETURN',
            relatedDocId: created.id,
            movementDate: new Date(data.returnDate),
            details: resolvedDetails.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
            })),
            createdBy: employee.id,
          },
          tx
        )

        // 발주 상세의 납품수량 감소, 잔량 증가
        for (const d of resolvedDetails) {
          await tx.salesOrderDetail.updateMany({
            where: { salesOrderId: data.salesOrderId, itemId: d.itemId },
            data: { deliveredQty: { decrement: d.quantity }, remainingQty: { increment: d.quantity } },
          })
        }

        // 발주 상태를 IN_PROGRESS로 복원 (완료였던 경우)
        if (salesOrder.status === 'COMPLETED') {
          await tx.salesOrder.update({
            where: { id: data.salesOrderId },
            data: { status: 'IN_PROGRESS' },
          })
        }
      }

      return created
    })

    return successResponse({ ...salesReturn, autoCreated })
  } catch (error) {
    return handleApiError(error)
  }
}
