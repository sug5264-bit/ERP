import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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
        where: { id: session.user.id },
        select: { employeeId: true },
      })
      const voucher = await prisma.voucher.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: user?.employeeId || undefined,
        },
      })
      return successResponse(voucher)
    }

    // 일반 수정
    if (body.details) {
      const totalDebit = body.details.reduce((s: number, d: any) => s + (d.debitAmount || 0), 0)
      const totalCredit = body.details.reduce((s: number, d: any) => s + (d.creditAmount || 0), 0)
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return errorResponse('차변과 대변의 합계가 일치하지 않습니다.', 'BALANCE_ERROR')
      }

      await prisma.voucherDetail.deleteMany({ where: { voucherId: id } })

      const voucher = await prisma.voucher.update({
        where: { id },
        data: {
          voucherDate: body.voucherDate ? new Date(body.voucherDate) : undefined,
          voucherType: body.voucherType,
          description: body.description,
          totalDebit,
          totalCredit,
          details: {
            create: body.details.map((d: any, idx: number) => ({
              lineNo: idx + 1,
              accountSubjectId: d.accountSubjectId,
              debitAmount: d.debitAmount || 0,
              creditAmount: d.creditAmount || 0,
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
      return successResponse(voucher)
    }

    return errorResponse('수정할 데이터가 없습니다.', 'NO_DATA')
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params

    const existing = await prisma.voucher.findUnique({ where: { id } })
    if (!existing) return errorResponse('전표를 찾을 수 없습니다.', 'NOT_FOUND', 404)

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
