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

    // Generate order number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const lastOrder = await prisma.shipperOrder.findFirst({
      where: { orderNo: { startsWith: `SH-${today}` } },
      orderBy: { orderNo: 'desc' },
    })
    const seq = lastOrder ? parseInt(lastOrder.orderNo.slice(-4)) + 1 : 1
    const orderNo = `SH-${today}-${String(seq).padStart(4, '0')}`

    const order = await prisma.shipperOrder.create({
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

    return successResponse(order)
  } catch (error) {
    return handleApiError(error)
  }
}
