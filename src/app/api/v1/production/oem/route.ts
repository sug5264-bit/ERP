import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const status = sp.get('status')

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') where.status = status

    const contracts = await prisma.oemContract.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const data = contracts.map((c) => ({
      id: c.id,
      contractNo: c.contractNo,
      partnerId: c.partnerId,
      contractName: c.contractName,
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      minimumOrderQty: c.minimumOrderQty ? Number(c.minimumOrderQty) : null,
      leadTimeDays: c.leadTimeDays,
      paymentTerms: c.paymentTerms,
      qualityTerms: c.qualityTerms,
      description: c.description,
      createdAt: c.createdAt,
    }))

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

const OEM_STATUSES = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'TERMINATED'] as const

const createOemSchema = z.object({
  contractNo: z.string().min(1),
  partnerId: z.string().min(1),
  contractName: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(OEM_STATUSES).optional(),
  minimumOrderQty: z.number().optional(),
  leadTimeDays: z.number().int().optional(),
  paymentTerms: z.string().optional(),
  qualityTerms: z.string().optional(),
  description: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('inventory', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createOemSchema.parse(body)

    const contract = await prisma.oemContract.create({
      data: {
        contractNo: data.contractNo,
        partnerId: data.partnerId,
        contractName: data.contractName,
        startDate: new Date(data.startDate),
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
