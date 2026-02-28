import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { createVoucherSchema } from '@/lib/validations/accounting'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        createdBy: { select: { nameKo: true, employeeNo: true } },
        approvedBy: { select: { nameKo: true, employeeNo: true } },
        fiscalYear: true,
        details: {
          include: {
            accountSubject: { select: { code: true, nameKo: true, accountType: true } },
            partner: { select: { partnerName: true } },
            costCenter: { select: { name: true } },
          },
          orderBy: { lineNo: 'asc' },
        },
        taxInvoices: true,
      },
    })

    if (!voucher) {
      return errorResponse('전표를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    return successResponse(voucher)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await request.json()

    const existing = await prisma.voucher.findUnique({ where: { id } })
    if (!existing) return errorResponse('전표를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (existing.status !== 'DRAFT') {
      return errorResponse('작성 상태의 전표만 수정할 수 있습니다.', 'INVALID_STATUS')
    }

    // 승인 처리
    if (body.action === 'approve') {
      const user = await prisma.user.findUnique({
        where: { id: authResult.session.user.id },
        select: { employeeId: true },
      })
      if (!user?.employeeId) {
        return errorResponse('사원 정보가 연결되어 있지 않습니다. 승인 권한을 확인하세요.', 'NO_EMPLOYEE')
      }
      // 작성자와 승인자가 동일한 경우 차단 (직무분리 원칙)
      if (user.employeeId === existing.createdById) {
        return errorResponse('작성자는 승인할 수 없습니다.', 'FORBIDDEN', 403)
      }
      const voucher = await prisma.voucher.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: user.employeeId,
        },
      })
      return successResponse(voucher)
    }

    // 일반 수정
    if (body.details) {
      // 수정 데이터를 전표 생성 스키마로 검증
      const detailsSchema = createVoucherSchema.shape.details
      const parsedDetails = detailsSchema.parse(body.details)

      const totalDebitCents = parsedDetails.reduce((s, d) => s + Math.round(d.debitAmount * 100), 0)
      const totalCreditCents = parsedDetails.reduce((s, d) => s + Math.round(d.creditAmount * 100), 0)
      if (totalDebitCents !== totalCreditCents) {
        return errorResponse('차변과 대변의 합계가 일치하지 않습니다.', 'BALANCE_ERROR')
      }
      const totalDebit = totalDebitCents / 100
      const totalCredit = totalCreditCents / 100

      const voucher = await prisma.$transaction(async (tx) => {
        await tx.voucherDetail.deleteMany({ where: { voucherId: id } })
        return tx.voucher.update({
          where: { id },
          data: {
            voucherDate: body.voucherDate ? new Date(body.voucherDate) : undefined,
            voucherType: body.voucherType,
            description: body.description,
            totalDebit,
            totalCredit,
            details: {
              create: parsedDetails.map((d, idx) => ({
                lineNo: idx + 1,
                accountSubjectId: d.accountSubjectId!,
                debitAmount: d.debitAmount,
                creditAmount: d.creditAmount,
                partnerId: d.partnerId || null,
                description: d.description,
                costCenterId: d.costCenterId || null,
              })),
            },
          },
          include: {
            details: {
              include: {
                accountSubject: { select: { code: true, nameKo: true } },
              },
            },
          },
        })
      })
      return successResponse(voucher)
    }

    return errorResponse('수정할 데이터가 없습니다.', 'NO_DATA')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const existing = await prisma.voucher.findUnique({ where: { id } })
    if (!existing) return errorResponse('전표를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (existing.status !== 'DRAFT') {
      return errorResponse('작성 상태의 전표만 삭제할 수 있습니다.', 'INVALID_STATUS', 400)
    }

    await prisma.$transaction(async (tx) => {
      await tx.taxInvoice.deleteMany({ where: { voucherId: id } })
      await tx.voucherDetail.deleteMany({ where: { voucherId: id } })
      await tx.voucher.delete({ where: { id } })
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
