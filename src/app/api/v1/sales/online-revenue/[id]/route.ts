import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { z } from 'zod'

const updateSchema = z.object({
  revenueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  salesType: z.enum(['ONLINE', 'OFFLINE']).optional(),
  channel: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional().nullable(),
  totalSales: z.number().min(0).max(999_999_999_999).optional(),
  totalFee: z.number().min(0).max(999_999_999_999).optional(),
  orderCount: z.number().int().min(0).max(999_999).optional(),
  memo: z.string().max(5000).optional().nullable(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const record = await prisma.onlineSalesRevenue.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            item: { select: { id: true, itemCode: true, itemName: true, barcode: true, unit: true } },
          },
        },
      },
    })
    if (!record) return errorResponse('매출 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    return successResponse(record)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const existing = await prisma.onlineSalesRevenue.findUnique({ where: { id } })
    if (!existing) return errorResponse('매출 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const body = await request.json()
    const data = updateSchema.parse(body)

    const totalSales = data.totalSales ?? Number(existing.totalSales)
    const totalFee = data.totalFee ?? Number(existing.totalFee)

    const updated = await prisma.onlineSalesRevenue.update({
      where: { id },
      data: {
        ...(data.revenueDate !== undefined && { revenueDate: new Date(data.revenueDate) }),
        ...(data.salesType !== undefined && { salesType: data.salesType }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.totalSales !== undefined && { totalSales: data.totalSales }),
        ...(data.totalFee !== undefined && { totalFee: data.totalFee }),
        netRevenue: totalSales - totalFee,
        ...(data.orderCount !== undefined && { orderCount: data.orderCount }),
        ...(data.memo !== undefined && { memo: data.memo || null }),
      },
    })

    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('sales', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const existing = await prisma.onlineSalesRevenue.findUnique({ where: { id } })
    if (!existing) return errorResponse('매출 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    await prisma.onlineSalesRevenue.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
