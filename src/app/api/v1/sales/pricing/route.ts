import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'
import { z } from 'zod'

export async function GET(_request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

    const prices = await prisma.salesPrice.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const data = prices.map((p) => ({
      id: p.id,
      partnerId: p.partnerId,
      itemId: p.itemId,
      unitPrice: Number(p.unitPrice),
      startDate: p.startDate,
      endDate: p.endDate,
      minQty: p.minQty ? Number(p.minQty) : null,
      isActive: p.isActive,
      remark: p.remark,
      createdAt: p.createdAt,
    }))

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

const createPriceSchema = z.object({
  partnerId: z.string().min(1),
  itemId: z.string().min(1),
  unitPrice: z.number(),
  startDate: z.string(),
  endDate: z.string().optional(),
  minQty: z.number().optional(),
  isActive: z.boolean().optional(),
  remark: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createPriceSchema.parse(body)

    const price = await prisma.salesPrice.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    })

    return successResponse(price)
  } catch (error) {
    return handleApiError(error)
  }
}
