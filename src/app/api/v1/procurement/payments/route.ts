import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createPurchasePaymentSchema } from '@/lib/validations/procurement'
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
      prisma.purchasePayment.findMany({
        where, include: { partner: true },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.purchasePayment.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createPurchasePaymentSchema.parse(body)
    const paymentNo = await generateDocumentNumber('PMT', new Date(data.paymentDate))

    const payment = await prisma.purchasePayment.create({
      data: {
        paymentNo, paymentDate: new Date(data.paymentDate),
        partnerId: data.partnerId, totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod || null, description: data.description || null,
      },
      include: { partner: true },
    })
    return successResponse(payment)
  } catch (error) { return handleApiError(error) }
}
