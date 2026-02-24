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
import { createSalesReturnSchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult

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
          details: { include: { item: { select: { id: true, itemName: true } } } },
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
    const authResult = await requirePermissionCheck('sales', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const data = createSalesReturnSchema.parse(body)
    const returnNo = await generateDocumentNumber('RT', new Date(data.returnDate))

    // 반품 상세가 있으면 totalAmount를 자동 계산
    const details = data.details || []
    const computedTotal =
      details.length > 0 ? details.reduce((sum, d) => sum + Math.round(d.quantity * d.unitPrice), 0) : data.totalAmount

    const salesReturn = await prisma.salesReturn.create({
      data: {
        returnNo,
        returnDate: new Date(data.returnDate),
        salesOrderId: data.salesOrderId,
        partnerId: data.partnerId,
        reason: data.reason,
        reasonDetail: data.reasonDetail || null,
        totalAmount: computedTotal,
        ...(details.length > 0 && {
          details: {
            create: details.map((d) => ({
              itemId: d.itemId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              amount: Math.round(d.quantity * d.unitPrice),
              remark: d.remark || null,
            })),
          },
        }),
      },
      include: {
        salesOrder: { select: { id: true, orderNo: true } },
        partner: { select: { id: true, partnerName: true } },
        details: { include: { item: { select: { id: true, itemName: true } } } },
      },
    })

    return successResponse(salesReturn)
  } catch (error) {
    return handleApiError(error)
  }
}
