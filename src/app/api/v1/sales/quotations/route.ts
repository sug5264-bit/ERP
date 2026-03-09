import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createQuotationSchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'
import { ensureItemExists, ensurePartnerExists } from '@/lib/auto-sync'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('sales', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status
    const partnerId = sp.get('partnerId')
    if (partnerId) where.partnerId = partnerId
    const [items, totalCount] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          partner: { select: { id: true, partnerCode: true, partnerName: true } },
          employee: { select: { id: true, nameKo: true } },
          _count: { select: { details: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.quotation.count({ where }),
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
    const data = createQuotationSchema.parse(body)
    const employee = await prisma.employee.findFirst({
      where: { user: { id: authResult.session.user.id } },
      select: { id: true },
    })
    if (!employee) return errorResponse('사원 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const autoCreated: string[] = []

    const quotation = await prisma.$transaction(async (tx) => {
      // 거래처 자동 생성/확인
      const partnerId = await ensurePartnerExists({
        partnerId: data.partnerId,
        partnerName: data.partnerName,
        partnerCode: data.partnerCode,
        bizNo: data.bizNo,
        partnerType: 'SALES',
      }, tx)
      if (partnerId && !data.partnerId && data.partnerName) {
        autoCreated.push(`거래처 "${data.partnerName}" 자동 생성`)
      }

      // 품목 자동 생성/확인
      const resolvedDetails = []
      for (const d of data.details) {
        const itemId = await ensureItemExists({
          itemId: d.itemId,
          itemCode: d.itemCode,
          itemName: d.itemName,
          specification: d.specification,
          unit: d.unit,
          standardPrice: d.unitPrice,
          barcode: d.barcode,
        }, tx)
        if (!d.itemId && d.itemName) {
          autoCreated.push(`품목 "${d.itemName}" 자동 생성`)
        }
        resolvedDetails.push({ ...d, itemId })
      }

      // 품목별 세금유형 조회
      const itemIds = resolvedDetails.map((d) => d.itemId)
      const itemsInfo = await tx.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, taxType: true },
      })
      const taxTypeMap = new Map(itemsInfo.map((i) => [i.id, i.taxType]))

      const details = resolvedDetails.map((d, idx) => {
        const supplyAmount = Math.round(d.quantity * d.unitPrice)
        const taxType = taxTypeMap.get(d.itemId) || 'TAXABLE'
        const taxAmount = taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
        return {
          lineNo: idx + 1,
          itemId: d.itemId,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          supplyAmount,
          taxAmount,
          totalAmount: supplyAmount + taxAmount,
          remark: d.remark || null,
        }
      })
      const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
      const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

      const quotationNo = await generateDocumentNumber('QT', new Date(data.quotationDate), tx)
      return tx.quotation.create({
        data: {
          quotationNo,
          quotationDate: new Date(data.quotationDate),
          partnerId: partnerId || null,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          totalSupply,
          totalTax,
          totalAmount: totalSupply + totalTax,
          employeeId: employee.id,
          description: data.description || null,
          details: { create: details },
        },
        include: { partner: true, details: { include: { item: true } } },
      })
    })
    return successResponse({ ...quotation, autoCreated })
  } catch (error) {
    return handleApiError(error)
  }
}
