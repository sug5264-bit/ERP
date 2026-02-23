import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await req.json()

    const company = await prisma.$transaction(async (tx) => {
      if (body.isDefault) {
        await tx.company.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false },
        })
      }
      const updated = await tx.company.update({
        where: { id },
        data: {
          companyName: body.companyName,
          bizNo: body.bizNo || null,
          ceoName: body.ceoName || null,
          bizType: body.bizType || null,
          bizCategory: body.bizCategory || null,
          address: body.address || null,
          phone: body.phone || null,
          fax: body.fax || null,
          email: body.email || null,
          bankName: body.bankName || null,
          bankAccount: body.bankAccount || null,
          bankHolder: body.bankHolder || null,
          isDefault: body.isDefault || false,
        },
      })
      return updated
    })

    return successResponse(company)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    await prisma.company.delete({ where: { id } })
    return successResponse({ message: '회사 정보가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
