import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createPurchaseRequestSchema } from '@/lib/validations/procurement'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: any = {}
    const status = sp.get('status')
    if (status) where.status = status
    const [items, totalCount] = await Promise.all([
      prisma.purchaseRequest.findMany({
        where, include: { department: true, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.purchaseRequest.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createPurchaseRequestSchema.parse(body)
    const requestNo = await generateDocumentNumber('PR', new Date(data.requestDate))

    const req = await prisma.purchaseRequest.create({
      data: {
        requestNo, requestDate: new Date(data.requestDate),
        departmentId: data.departmentId, requesterId: session.user!.id!,
        reason: data.reason || null,
        details: {
          create: data.details.map((d) => ({
            itemId: d.itemId, quantity: d.quantity,
            desiredDate: d.desiredDate ? new Date(d.desiredDate) : null,
            remark: d.remark || null,
          })),
        },
      },
      include: { department: true, details: { include: { item: true } } },
    })
    return successResponse(req)
  } catch (error) { return handleApiError(error) }
}
