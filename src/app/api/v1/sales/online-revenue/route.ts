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

const itemDetailSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
})

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
  items: z.array(itemDetailSchema).optional(),
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
        include: {
          details: {
            include: {
              item: {
                select: { id: true, itemCode: true, itemName: true, barcode: true, unit: true },
              },
            },
          },
        },
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
    const hasItems = data.items && data.items.length > 0

    if (hasItems) {
      // Create with items and deduct stock in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const revenue = await tx.onlineSalesRevenue.create({
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
            details: {
              create: data.items!.map((item) => ({
                itemId: item.itemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: Math.round(item.quantity * item.unitPrice),
              })),
            },
          },
          include: {
            details: {
              include: {
                item: {
                  select: { id: true, itemCode: true, itemName: true, barcode: true, unit: true },
                },
              },
            },
          },
        })

        // Deduct stock for each item
        for (const item of data.items!) {
          const balances = await tx.stockBalance.findMany({
            where: { itemId: item.itemId },
            select: { id: true, quantity: true, warehouseId: true },
            orderBy: { quantity: 'desc' },
          })
          const totalStock = balances.reduce((sum, b) => sum + Number(b.quantity), 0)
          if (totalStock < item.quantity) {
            const itemInfo = await tx.item.findUnique({
              where: { id: item.itemId },
              select: { itemName: true },
            })
            throw new Error(
              `품목 "${itemInfo?.itemName || item.itemId}"의 재고가 부족합니다. (현재고: ${totalStock}, 출고량: ${item.quantity})`
            )
          }

          let remaining = item.quantity
          for (const bal of balances) {
            if (remaining <= 0) break
            const available = Number(bal.quantity)
            const deduct = Math.min(available, remaining)
            if (deduct > 0) {
              const updateResult = await tx.stockBalance.updateMany({
                where: { id: bal.id, quantity: { gte: deduct } },
                data: { quantity: { decrement: deduct } },
              })
              if (updateResult.count === 0) {
                const itemInfo = await tx.item.findUnique({
                  where: { id: item.itemId },
                  select: { itemName: true },
                })
                throw new Error(
                  `품목 "${itemInfo?.itemName || item.itemId}"의 재고가 동시 처리로 변경되었습니다. 다시 시도해주세요.`
                )
              }
              remaining -= deduct
            }
          }
        }

        return revenue
      })
      return successResponse(result)
    }

    // Simple creation without items
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
