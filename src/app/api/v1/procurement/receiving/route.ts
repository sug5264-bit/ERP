import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createReceivingSchema } from '@/lib/validations/procurement'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = {}
    const status = sp.get('status')
    if (status) where.status = status
    const [items, totalCount] = await Promise.all([
      prisma.receiving.findMany({
        where, include: { purchaseOrder: true, partner: true, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.receiving.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createReceivingSchema.parse(body)

    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.purchaseOrderId }, include: { partner: true } })
    if (!po) return errorResponse('발주를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    const receivingNo = await generateDocumentNumber('RCV', new Date(data.receivingDate))

    const result = await prisma.$transaction(async (tx) => {
      const receiving = await tx.receiving.create({
        data: {
          receivingNo, receivingDate: new Date(data.receivingDate),
          purchaseOrderId: data.purchaseOrderId, partnerId: po.partnerId,
          details: {
            create: data.details.map((d) => ({
              itemId: d.itemId, orderedQty: d.orderedQty, receivedQty: d.receivedQty,
              acceptedQty: d.acceptedQty, rejectedQty: d.rejectedQty || 0,
              unitPrice: d.unitPrice, amount: d.acceptedQty * d.unitPrice,
            })),
          },
        },
        include: { details: { include: { item: true } }, partner: true, purchaseOrder: true },
      })

      for (const d of data.details) {
        await tx.purchaseOrderDetail.updateMany({
          where: { purchaseOrderId: data.purchaseOrderId, itemId: d.itemId },
          data: { receivedQty: { increment: d.acceptedQty }, remainingQty: { decrement: d.acceptedQty } },
        })
      }
      return receiving
    })
    return successResponse(result)
  } catch (error) { return handleApiError(error) }
}
