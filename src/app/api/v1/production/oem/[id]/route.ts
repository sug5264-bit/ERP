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

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, ctx: RouteContext) {
  try {
    const authResult = await requirePermissionCheck('production', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await ctx.params
    const body = await request.json()

    const OEM_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED'] as const
    const schema = z.object({
      contractName: z.string().min(1).optional(),
      partnerId: z.string().min(1).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(OEM_STATUSES).optional(),
      minimumOrderQty: z.number().optional(),
      leadTimeDays: z.number().int().optional(),
      paymentTerms: z.string().optional(),
      qualityTerms: z.string().optional(),
      description: z.string().optional(),
    })

    const data = schema.parse(body)

    const existing = await prisma.oemContract.findUnique({ where: { id } })
    if (!existing) return errorResponse('OEM 계약을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const contract = await prisma.oemContract.update({
      where: { id },
      data: {
        contractName: data.contractName,
        partnerId: data.partnerId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        status: data.status,
        minimumOrderQty: data.minimumOrderQty,
        leadTimeDays: data.leadTimeDays,
        paymentTerms: data.paymentTerms,
        qualityTerms: data.qualityTerms,
        description: data.description,
      },
    })

    return successResponse(contract)
  } catch (error) {
    return handleApiError(error)
  }
}
