import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createDeliverySchema } from '@/lib/validations/sales'
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
    const salesChannel = sp.get('salesChannel')
    if (salesChannel) where.salesOrder = { salesChannel }
    const [items, totalCount] = await Promise.all([
      prisma.delivery.findMany({
        where, include: { salesOrder: true, partner: true, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.delivery.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createDeliverySchema.parse(body)

    const salesOrder = await prisma.salesOrder.findUnique({ where: { id: data.salesOrderId }, include: { partner: true } })
    if (!salesOrder) return errorResponse('수주를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const deliveryNo = await generateDocumentNumber('DLV', new Date(data.deliveryDate))

    const result = await prisma.$transaction(async (tx) => {
      const delivery = await tx.delivery.create({
        data: {
          deliveryNo, deliveryDate: new Date(data.deliveryDate),
          salesOrderId: data.salesOrderId, partnerId: salesOrder.partnerId,
          deliveryAddress: data.deliveryAddress || null,
          details: {
            create: data.details.map((d) => ({
              itemId: d.itemId, quantity: d.quantity, unitPrice: d.unitPrice,
              amount: d.quantity * d.unitPrice,
            })),
          },
        },
        include: { details: { include: { item: true } }, partner: true, salesOrder: true },
      })

      for (const d of data.details) {
        await tx.salesOrderDetail.updateMany({
          where: { salesOrderId: data.salesOrderId, itemId: d.itemId },
          data: { deliveredQty: { increment: d.quantity }, remainingQty: { decrement: d.quantity } },
        })
      }
      return delivery
    })
    return successResponse(result)
  } catch (error) { return handleApiError(error) }
}
