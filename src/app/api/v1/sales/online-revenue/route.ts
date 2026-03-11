import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { z } from 'zod'

const createOnlineRevenueSchema = z.object({
  revenueDate: z
    .string()
    .min(1)
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  salesType: z.enum(['ONLINE', 'OFFLINE']).optional().default('ONLINE'),
  channel: z.string().min(1).max(50),
  description: z.string().max(1000).optional().nullable(),
  totalSales: z.number().min(0).max(999_999_999_999),
  totalFee: z.number().min(0).max(999_999_999_999).optional().default(0),
  orderCount: z.number().int().min(0).max(999_999).optional().default(0),
  memo: z.string().max(5000).optional().nullable(),
})

const batchCreateSchema = z.object({
  entries: z.array(createOnlineRevenueSchema).min(1).max(100),
})

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const salesType = sp.get('salesType')
    if (salesType && salesType !== 'all') where.salesType = salesType
    const channel = sp.get('channel')
    if (channel && channel !== 'all') where.channel = channel
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
        if (!isNaN(d.getTime())) dateRange.lte = d
      }
      where.revenueDate = dateRange
    }

    const [items, totalCount] = await Promise.all([
      prisma.onlineSalesRevenue.findMany({
        where,
        orderBy: { revenueDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.onlineSalesRevenue.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()

    // Support both single and batch creation
    if (body.entries) {
      const data = batchCreateSchema.parse(body)
      const results = await prisma.$transaction(
        data.entries.map((entry) =>
          prisma.onlineSalesRevenue.create({
            data: {
              revenueDate: new Date(entry.revenueDate),
              salesType: entry.salesType || 'ONLINE',
              channel: entry.channel,
              description: entry.description || null,
              totalSales: entry.totalSales,
              totalFee: entry.totalFee || 0,
              netRevenue: entry.totalSales - (entry.totalFee || 0),
              orderCount: entry.orderCount || 0,
              memo: entry.memo || null,
              createdBy: authResult.session.user.id,
            },
          })
        )
      )
      return successResponse(results)
    }

    const data = createOnlineRevenueSchema.parse(body)
    const result = await prisma.onlineSalesRevenue.create({
      data: {
        revenueDate: new Date(data.revenueDate),
        salesType: data.salesType || 'ONLINE',
        channel: data.channel,
        description: data.description || null,
        totalSales: data.totalSales,
        totalFee: data.totalFee || 0,
        netRevenue: data.totalSales - (data.totalFee || 0),
        orderCount: data.orderCount || 0,
        memo: data.memo || null,
        createdBy: authResult.session.user.id,
      },
    })
    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
