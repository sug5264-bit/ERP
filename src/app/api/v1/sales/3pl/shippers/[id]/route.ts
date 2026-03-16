import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.shipperCompany.findUnique({ where: { id } })
    if (!existing) {
      return errorResponse('화주사를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    if (body.companyCode && body.companyCode !== existing.companyCode) {
      const dup = await prisma.shipperCompany.findUnique({ where: { companyCode: body.companyCode } })
      if (dup) {
        return errorResponse('이미 존재하는 화주사 코드입니다.', 'DUPLICATE_CODE', 400)
      }
    }

    const result = await prisma.shipperCompany.update({
      where: { id },
      data: {
        ...(body.companyName !== undefined && { companyName: body.companyName.trim() }),
        ...(body.companyCode !== undefined && { companyCode: body.companyCode }),
        ...(body.bizNo !== undefined && { bizNo: body.bizNo || null }),
        ...(body.ceoName !== undefined && { ceoName: body.ceoName || null }),
        ...(body.phone !== undefined && { phone: body.phone || null }),
        ...(body.email !== undefined && { email: body.email || null }),
        ...(body.address !== undefined && { address: body.address || null }),
        ...(body.contractStart !== undefined && {
          contractStart: body.contractStart ? new Date(body.contractStart) : null,
        }),
        ...(body.contractEnd !== undefined && { contractEnd: body.contractEnd ? new Date(body.contractEnd) : null }),
        ...(body.monthlyFee !== undefined && { monthlyFee: body.monthlyFee }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.contactName !== undefined && { contactName: body.contactName || null }),
        ...(body.contactPhone !== undefined && { contactPhone: body.contactPhone || null }),
        ...(body.contactEmail !== undefined && { contactEmail: body.contactEmail || null }),
        ...(body.contractType !== undefined && { contractType: body.contractType }),
        ...(body.paymentTerms !== undefined && { paymentTerms: body.paymentTerms }),
        ...(body.billingCycle !== undefined && { billingCycle: body.billingCycle }),
        ...(body.memo !== undefined && { memo: body.memo || null }),
      },
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const existing = await prisma.shipperCompany.findUnique({
      where: { id },
      include: {
        _count: { select: { shipperOrders: true } },
      },
    })
    if (!existing) {
      return errorResponse('화주사를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    if (existing._count.shipperOrders > 0) {
      return errorResponse(
        `해당 화주사에 주문 ${existing._count.shipperOrders}건이 있어 삭제할 수 없습니다. 비활성화를 사용해주세요.`,
        'HAS_ORDERS',
        400
      )
    }

    await prisma.$transaction([
      prisma.user.updateMany({ where: { shipperId: id }, data: { shipperId: null, accountType: 'INTERNAL' } }),
      prisma.shipperRate.deleteMany({ where: { shipperId: id } }),
      prisma.shipperItem.deleteMany({ where: { shipperId: id } }),
      prisma.shipperCompany.delete({ where: { id } }),
    ])

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
