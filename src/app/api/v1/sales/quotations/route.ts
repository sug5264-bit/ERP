import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, getSession, getPaginationParams, buildMeta } from '@/lib/api-helpers'
import { createQuotationSchema } from '@/lib/validations/sales'
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
    const partnerId = sp.get('partnerId')
    if (partnerId) where.partnerId = partnerId
    const [items, totalCount] = await Promise.all([
      prisma.quotation.findMany({
        where, include: { partner: true, employee: true, details: { include: { item: true } } },
        orderBy: { createdAt: 'desc' }, skip, take: pageSize,
      }),
      prisma.quotation.count({ where }),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)
    const body = await request.json()
    const data = createQuotationSchema.parse(body)
    const quotationNo = await generateDocumentNumber('QT', new Date(data.quotationDate))
    const employee = await prisma.employee.findFirst({ where: { user: { id: session.user!.id! } } })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const details = data.details.map((d, idx) => {
      const supplyAmount = d.quantity * d.unitPrice
      const taxAmount = Math.round(supplyAmount * 0.1)
      return { lineNo: idx + 1, itemId: d.itemId, quantity: d.quantity, unitPrice: d.unitPrice, supplyAmount, taxAmount, totalAmount: supplyAmount + taxAmount, remark: d.remark || null }
    })
    const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
    const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

    const quotation = await prisma.quotation.create({
      data: {
        quotationNo, quotationDate: new Date(data.quotationDate), partnerId: data.partnerId,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        totalSupply, totalTax, totalAmount: totalSupply + totalTax,
        employeeId: employee.id, description: data.description || null,
        details: { create: details },
      },
      include: { partner: true, details: { include: { item: true } } },
    })
    return successResponse(quotation)
  } catch (error) { return handleApiError(error) }
}
