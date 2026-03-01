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
import { createTaxInvoiceSchema } from '@/lib/validations/accounting'
import { generateDocumentNumber } from '@/lib/doc-number'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const invoiceType = searchParams.get('invoiceType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const rawSearch = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (invoiceType) where.invoiceType = invoiceType
    if (startDate || endDate) {
      const dateRange: { gte?: Date; lte?: Date } = {}
      if (startDate) {
        const d = new Date(startDate)
        if (!isNaN(d.getTime())) dateRange.gte = d
      }
      if (endDate) {
        const d = new Date(endDate)
        if (!isNaN(d.getTime())) dateRange.lte = d
      }
      where.issueDate = dateRange
    }
    if (rawSearch) {
      const search = sanitizeSearchQuery(rawSearch)
      where.OR = [
        { invoiceNo: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { buyerName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [invoices, totalCount] = await Promise.all([
      prisma.taxInvoice.findMany({
        where,
        include: {
          partner: { select: { partnerName: true } },
          _count: { select: { items: true } },
        },
        skip,
        take: pageSize,
        orderBy: { issueDate: 'desc' },
      }),
      prisma.taxInvoice.count({ where }),
    ])

    return successResponse(invoices, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createTaxInvoiceSchema.parse(body)

    const supplyAmount = data.items.reduce((s, i) => s + i.supplyAmount, 0)
    const taxAmount = data.items.reduce((s, i) => s + i.taxAmount, 0)
    const totalAmount = supplyAmount + taxAmount

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNo = await generateDocumentNumber('TI', new Date(data.issueDate), tx)
      return tx.taxInvoice.create({
        data: {
          invoiceNo,
          issueDate: new Date(data.issueDate),
          invoiceType: data.invoiceType,
          supplierBizNo: data.supplierBizNo,
          supplierName: data.supplierName,
          supplierCeo: data.supplierCeo,
          supplierAddress: data.supplierAddress,
          supplierBizType: data.supplierBizType,
          supplierBizCategory: data.supplierBizCategory,
          buyerBizNo: data.buyerBizNo,
          buyerName: data.buyerName,
          buyerCeo: data.buyerCeo,
          buyerAddress: data.buyerAddress,
          buyerBizType: data.buyerBizType,
          buyerBizCategory: data.buyerBizCategory,
          supplyAmount,
          taxAmount,
          totalAmount,
          partnerId: data.partnerId || null,
          voucherId: data.voucherId || null,
          items: {
            create: data.items.map((item) => ({
              itemDate: new Date(item.itemDate),
              itemName: item.itemName,
              specification: item.specification,
              qty: item.qty,
              unitPrice: item.unitPrice,
              supplyAmount: item.supplyAmount,
              taxAmount: item.taxAmount,
            })),
          },
        },
        include: { items: true },
      })
    })

    return successResponse(invoice)
  } catch (error) {
    return handleApiError(error)
  }
}
