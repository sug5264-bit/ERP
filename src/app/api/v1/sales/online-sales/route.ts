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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const channel = sp.get('channel')
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')

    const where: Record<string, unknown> = {}
    if (channel && channel !== 'all') {
      where.salesChannel = channel
    }
    if (startDate || endDate) {
      where.orderDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [orders, totalCount] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        include: {
          partner: { select: { partnerName: true, salesChannel: true } },
          details: {
            include: { item: { select: { itemName: true, itemCode: true } } },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.salesOrder.count({ where }),
    ])

    const data = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      orderDate: o.orderDate,
      partnerName: o.partner?.partnerName || '-',
      channel: o.partner?.salesChannel || 'OFFLINE',
      recipientName: o.recipientName || '-',
      recipientAddress: o.recipientAddress || '-',
      totalAmount: Number(o.totalAmount),
      status: o.status,
      trackingNo: o.trackingNo,
      items: o.details.map((d) => ({
        itemName: d.item.itemName,
        itemCode: d.item.itemCode,
        quantity: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        amount: Number(d.totalAmount),
      })),
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

const createOnlineSaleSchema = z.object({
  partnerId: z.string().min(1),
  orderDate: z.string(),
  recipientName: z.string().optional(),
  recipientContact: z.string().optional(),
  recipientZipCode: z.string().optional(),
  recipientAddress: z.string().optional(),
  requirements: z.string().optional(),
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      quantity: z.number().positive(),
      unitPrice: z.number(),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createOnlineSaleSchema.parse(body)

    let totalSupply = 0
    let totalTax = 0
    const details = data.items.map((item, i) => {
      const supply = item.quantity * item.unitPrice
      const tax = Math.round(supply * 0.1)
      totalSupply += supply
      totalTax += tax
      return {
        lineNo: i + 1,
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        supplyAmount: supply,
        taxAmount: tax,
        totalAmount: supply + tax,
        remainingQty: item.quantity,
      }
    })

    // employeeId 사전 조회 (트랜잭션 밖에서)
    const empId = (authResult as { session: { user: { employeeId: string | null } } }).session.user.employeeId
    const employeeId =
      empId || (await prisma.employee.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id || ''

    // 트랜잭션 + 유니크 제약 위반 시 재시도 (동시 요청 race condition 방지)
    let order
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
          const lastOrder = await tx.salesOrder.findFirst({
            where: { orderNo: { startsWith: `ON-${today}` } },
            orderBy: { orderNo: 'desc' },
          })
          const seq = lastOrder ? parseInt(lastOrder.orderNo.slice(-4), 10) + 1 : 1
          const orderNo = `ON-${today}-${String(seq).padStart(4, '0')}`

          return tx.salesOrder.create({
            data: {
              orderNo,
              orderDate: new Date(data.orderDate),
              partnerId: data.partnerId,
              totalSupply,
              totalTax,
              totalAmount: totalSupply + totalTax,
              recipientName: data.recipientName,
              recipientContact: data.recipientContact,
              recipientZipCode: data.recipientZipCode,
              recipientAddress: data.recipientAddress,
              requirements: data.requirements,
              employeeId,
              details: { create: details },
            },
          })
        })
        break
      } catch (e: unknown) {
        if (attempt === 2 || !(e instanceof Error) || !e.message.includes('Unique constraint')) throw e
      }
    }

    return successResponse(order!)
  } catch (error) {
    return handleApiError(error)
  }
}
