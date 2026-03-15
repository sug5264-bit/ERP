import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requireAuth,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}

    // Default: only show dispatchable statuses
    const status = sp.get('status')
    if (status) {
      where.status = status
    } else {
      where.status = { in: ['RECEIVED', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT'] }
    }

    const shipperId = sp.get('shipperId')
    if (shipperId) where.shipperId = shipperId

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
      where.orderDate = dateRange
    }

    const [items, totalCount] = await Promise.all([
      prisma.shipperOrder.findMany({
        where,
        include: {
          shipper: {
            select: { id: true, companyCode: true, companyName: true },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.shipperOrder.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()

    if (!body.orderId || typeof body.orderId !== 'string') {
      return errorResponse('주문 ID는 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    // Verify order exists
    const order = await prisma.shipperOrder.findUnique({
      where: { id: body.orderId },
      select: { id: true, status: true, pickedUpAt: true, deliveredAt: true },
    })
    if (!order) {
      return errorResponse('주문을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    const updateData: Record<string, unknown> = {}

    if (body.assignedDriver !== undefined) updateData.assignedDriver = body.assignedDriver
    if (body.assignedDriverPhone !== undefined) updateData.assignedDriverPhone = body.assignedDriverPhone
    if (body.trackingNo !== undefined) updateData.trackingNo = body.trackingNo
    if (body.shippingCost !== undefined) updateData.shippingCost = body.shippingCost
    if (body.carrier !== undefined) updateData.carrier = body.carrier

    if (body.status) {
      const validStatuses = ['RECEIVED', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']
      if (!validStatuses.includes(body.status)) {
        return errorResponse(`유효하지 않은 상태값입니다. (${validStatuses.join(', ')})`, 'VALIDATION_ERROR', 400)
      }
      updateData.status = body.status

      // Auto-set timestamps on status changes
      if (body.status === 'PROCESSING' && !order.pickedUpAt) {
        updateData.pickedUpAt = new Date()
      }
      if (body.status === 'DELIVERED' && !order.deliveredAt) {
        updateData.deliveredAt = new Date()
      }
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('변경할 데이터가 없습니다.', 'VALIDATION_ERROR', 400)
    }

    const result = await prisma.shipperOrder.update({
      where: { id: body.orderId },
      data: updateData,
      include: {
        shipper: {
          select: { id: true, companyCode: true, companyName: true },
        },
      },
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
