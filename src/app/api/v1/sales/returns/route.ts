import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const sp = req.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = {}
    const status = sp.get('status')
    if (status) where.status = status

    const [items, totalCount] = await Promise.all([
      prisma.salesReturn.findMany({
        where,
        include: {
          salesOrder: { select: { id: true, orderNo: true } },
          partner: { select: { id: true, partnerName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.salesReturn.count({ where }),
    ])

    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const returnNo = await generateDocumentNumber('RT', new Date(body.returnDate))

    const salesReturn = await prisma.salesReturn.create({
      data: {
        returnNo,
        returnDate: new Date(body.returnDate),
        salesOrderId: body.salesOrderId,
        partnerId: body.partnerId,
        reason: body.reason || 'OTHER',
        reasonDetail: body.reasonDetail || null,
        totalAmount: body.totalAmount || 0,
      },
      include: {
        salesOrder: { select: { id: true, orderNo: true } },
        partner: { select: { id: true, partnerName: true } },
      },
    })

    return successResponse(salesReturn)
  } catch (error) {
    return handleApiError(error)
  }
}
