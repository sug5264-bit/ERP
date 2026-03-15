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

    const shipperId = sp.get('shipperId')
    if (shipperId) where.shipperId = shipperId

    const status = sp.get('status')
    if (status) where.status = status

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

    const search = sp.get('search')
    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, totalCount] = await Promise.all([
      prisma.shipperOrder.findMany({
        where,
        include: {
          shipper: {
            select: { id: true, companyCode: true, companyName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
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

    if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
      return errorResponse('주문 ID 목록은 필수입니다.', 'VALIDATION_ERROR', 400)
    }
    if (!body.status || typeof body.status !== 'string') {
      return errorResponse('변경할 상태값은 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    const validStatuses = ['RECEIVED', 'PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']
    if (!validStatuses.includes(body.status)) {
      return errorResponse(`유효하지 않은 상태값입니다. (${validStatuses.join(', ')})`, 'VALIDATION_ERROR', 400)
    }

    const updateData: Record<string, unknown> = { status: body.status }
    if (body.status === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    const result = await prisma.shipperOrder.updateMany({
      where: { id: { in: body.orderIds } },
      data: updateData,
    })

    return successResponse({
      updatedCount: result.count,
      status: body.status,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
