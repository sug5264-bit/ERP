import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAuth, isErrorResponse, errorResponse } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipperId: true, accountType: true },
    })

    if (!user?.shipperId || user.accountType !== 'SHIPPER') {
      return errorResponse('화주사 계정이 아닙니다.', 'FORBIDDEN', 403)
    }

    const shipperId = user.shipperId
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { shipperId }

    if (startDate && endDate) {
      where.orderDate = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      }
    } else if (startDate) {
      where.orderDate = { gte: new Date(startDate) }
    } else if (endDate) {
      where.orderDate = { lte: new Date(endDate + 'T23:59:59.999Z') }
    }

    if (status) {
      where.status = status
    }

    const orders = await prisma.shipperOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNo: true,
        orderDate: true,
        recipientName: true,
        recipientAddress: true,
        itemName: true,
        quantity: true,
        shippingMethod: true,
        status: true,
        trackingNo: true,
        carrier: true,
        deliveredAt: true,
      },
    })

    return successResponse(orders)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const userId = authResult.session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { shipperId: true, accountType: true },
    })

    if (!user?.shipperId || user.accountType !== 'SHIPPER') {
      return errorResponse('화주사 계정이 아닙니다.', 'FORBIDDEN', 403)
    }

    const shipperId = user.shipperId
    const body = await request.json()

    // 입력값 기본 검증
    if (!body.recipientName || typeof body.recipientName !== 'string' || !body.recipientName.trim()) {
      return errorResponse('수취인 이름은 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.recipientAddress || typeof body.recipientAddress !== 'string' || !body.recipientAddress.trim()) {
      return errorResponse('수취인 주소는 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.itemName || typeof body.itemName !== 'string' || !body.itemName.trim()) {
      return errorResponse('품목명은 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (body.quantity !== undefined && (typeof body.quantity !== 'number' || body.quantity <= 0)) {
      return errorResponse('수량은 1 이상이어야 합니다.', 'VALIDATION_ERROR', 400)
    }

    // 트랜잭션 + 유니크 제약 위반 시 재시도 (동시 요청 race condition 방지)
    let order
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
          const lastOrder = await tx.shipperOrder.findFirst({
            where: { orderNo: { startsWith: `SH-${today}` } },
            orderBy: { orderNo: 'desc' },
          })
          const seq = lastOrder ? parseInt(lastOrder.orderNo.slice(-4), 10) + 1 : 1
          const orderNo = `SH-${today}-${String(seq).padStart(4, '0')}`

          return tx.shipperOrder.create({
            data: {
              orderNo,
              shipperId,
              orderDate: new Date(),
              senderName: body.senderName || '',
              senderPhone: body.senderPhone || null,
              senderAddress: body.senderAddress || null,
              recipientName: body.recipientName,
              recipientPhone: body.recipientPhone || null,
              recipientZipCode: body.recipientZipCode || null,
              recipientAddress: body.recipientAddress,
              itemName: body.itemName,
              quantity: body.quantity || 1,
              weight: body.weight ?? null,
              shippingMethod: body.shippingMethod || 'NORMAL',
              specialNote: body.specialNote || null,
              status: 'RECEIVED',
            },
          })
        })
        break // 성공 시 루프 종료
      } catch (err) {
        // P2002: unique constraint violation → 재시도
        if (
          attempt < 2 &&
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          continue
        }
        throw err
      }
    }

    return successResponse(order)
  } catch (error) {
    return handleApiError(error)
  }
}
