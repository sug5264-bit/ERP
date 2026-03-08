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
import { createPurchaseOrderSchema } from '@/lib/validations/sales'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)

    const where: Record<string, unknown> = {}
    const status = sp.get('status')
    if (status) where.status = status
    const startDate = sp.get('startDate')
    const endDate = sp.get('endDate')
    if (startDate || endDate) {
      where.orderDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    const [orders, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          partner: { select: { partnerName: true } },
          employee: { select: { nameKo: true } },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.purchaseOrder.count({ where }),
    ])

    const data = orders.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      orderDate: o.orderDate,
      supplierName: o.partner.partnerName,
      supplyAmount: Number(o.totalSupply),
      totalAmount: Number(o.totalAmount),
      status: o.status,
      managerName: o.employee.nameKo,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('purchasing', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createPurchaseOrderSchema.parse(body)

    let employeeId = authResult.session.user.employeeId
    if (!employeeId) {
      const employee = await prisma.employee.findFirst({ where: { user: { id: authResult.session.user.id } } })
      if (!employee)
        return errorResponse('사원 정보를 찾을 수 없습니다. 관리자에게 사원 연결을 요청하세요.', 'NOT_FOUND', 404)
      employeeId = employee.id
    }

    const isVatIncluded = data.vatIncluded !== false

    const itemIds = data.details.map((d) => d.itemId)
    const itemsInfo = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, taxType: true },
    })
    const itemInfoMap = new Map(itemsInfo.map((i) => [i.id, i]))

    const details = data.details.map((d, idx) => {
      const supplyAmount = Math.round(d.quantity * d.unitPrice)
      const taxType = itemInfoMap.get(d.itemId)?.taxType || 'TAXABLE'
      const taxAmount = isVatIncluded && taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
      return {
        lineNo: idx + 1,
        itemId: d.itemId,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        supplyAmount,
        taxAmount,
        amount: supplyAmount + taxAmount,
        remainingQty: d.quantity,
        remark: d.remark || null,
      }
    })
    const totalSupply = details.reduce((s, d) => s + d.supplyAmount, 0)
    const totalTax = details.reduce((s, d) => s + d.taxAmount, 0)

    const result = await prisma.$transaction(async (tx) => {
      const orderNo = await generateDocumentNumber('PO', new Date(data.orderDate), tx)
      return tx.purchaseOrder.create({
        data: {
          orderNo,
          orderDate: new Date(data.orderDate),
          partnerId: data.partnerId,
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          totalSupply,
          totalTax,
          totalAmount: totalSupply + totalTax,
          employeeId,
          description: data.description || null,
          vatIncluded: data.vatIncluded ?? true,
          details: { create: details },
        },
        include: {
          partner: { select: { partnerName: true } },
          details: { include: { item: { select: { itemName: true } } } },
        },
      })
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
