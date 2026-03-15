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

    const search = sp.get('search')
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { companyCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const isActive = sp.get('isActive')
    if (isActive === 'true') where.isActive = true
    else if (isActive === 'false') where.isActive = false

    const [items, totalCount] = await Promise.all([
      prisma.shipperCompany.findMany({
        where,
        include: {
          _count: {
            select: {
              shipperOrders: {
                where: {
                  status: { notIn: ['DELIVERED', 'RETURNED'] },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.shipperCompany.count({ where }),
    ])

    const data = items.map((item) => ({
      ...item,
      activeOrderCount: item._count.shipperOrders,
      _count: undefined,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()

    if (!body.companyName || typeof body.companyName !== 'string' || body.companyName.trim() === '') {
      return errorResponse('화주사명은 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    // Auto-generate companyCode as "SHP-XXXX"
    const lastCompany = await prisma.shipperCompany.findFirst({
      where: { companyCode: { startsWith: 'SHP-' } },
      orderBy: { companyCode: 'desc' },
      select: { companyCode: true },
    })

    let nextNumber = 1
    if (lastCompany) {
      const lastNumber = parseInt(lastCompany.companyCode.replace('SHP-', ''), 10)
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1
    }
    const companyCode = `SHP-${String(nextNumber).padStart(4, '0')}`

    // Check uniqueness (in case of manual codes)
    if (body.companyCode) {
      const existing = await prisma.shipperCompany.findUnique({
        where: { companyCode: body.companyCode },
      })
      if (existing) {
        return errorResponse('이미 존재하는 화주사 코드입니다.', 'DUPLICATE_CODE', 400)
      }
    }

    const result = await prisma.shipperCompany.create({
      data: {
        companyCode: body.companyCode || companyCode,
        companyName: body.companyName.trim(),
        bizNo: body.bizNo || null,
        ceoName: body.ceoName || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        contractStart: body.contractStart ? new Date(body.contractStart) : null,
        contractEnd: body.contractEnd ? new Date(body.contractEnd) : null,
        monthlyFee: body.monthlyFee ?? null,
        isActive: body.isActive ?? true,
        contactName: body.contactName || null,
        contactPhone: body.contactPhone || null,
        contactEmail: body.contactEmail || null,
        contractType: body.contractType || 'STANDARD',
        paymentTerms: body.paymentTerms || 'POSTPAID',
        billingCycle: body.billingCycle || 'MONTHLY',
        memo: body.memo || null,
      },
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
