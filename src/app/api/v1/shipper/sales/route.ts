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
    const salesChannel = searchParams.get('salesChannel')

    const where: Record<string, unknown> = { shipperId }

    if (startDate && endDate) {
      where.salesDate = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z'),
      }
    } else if (startDate) {
      where.salesDate = { gte: new Date(startDate) }
    } else if (endDate) {
      where.salesDate = { lte: new Date(endDate + 'T23:59:59.999Z') }
    }

    if (salesChannel) {
      where.salesChannel = salesChannel
    }

    const sales = await prisma.shipperSales.findMany({
      where,
      orderBy: { salesDate: 'desc' },
      select: {
        id: true,
        salesDate: true,
        salesChannel: true,
        customerName: true,
        itemName: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        memo: true,
        createdAt: true,
      },
    })

    return successResponse(sales)
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

    // 필수값 검증
    if (!body.salesDate) {
      return errorResponse('매출일은 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.itemName || typeof body.itemName !== 'string' || !body.itemName.trim()) {
      return errorResponse('상품명은 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (body.unitPrice == null || isNaN(Number(body.unitPrice))) {
      return errorResponse('단가는 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (body.totalAmount == null || isNaN(Number(body.totalAmount))) {
      return errorResponse('합계금액은 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    const quantity = body.quantity != null ? Number(body.quantity) : 1
    if (quantity <= 0) {
      return errorResponse('수량은 0보다 커야 합니다.', 'VALIDATION_ERROR', 400)
    }

    const sale = await prisma.shipperSales.create({
      data: {
        shipperId,
        salesDate: new Date(body.salesDate),
        salesChannel: body.salesChannel?.trim() || null,
        customerName: body.customerName?.trim() || null,
        itemName: body.itemName.trim(),
        quantity,
        unitPrice: Number(body.unitPrice),
        totalAmount: Number(body.totalAmount),
        memo: body.memo?.trim() || null,
      },
    })

    return successResponse(sale)
  } catch (error) {
    return handleApiError(error)
  }
}
