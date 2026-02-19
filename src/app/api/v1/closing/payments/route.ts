import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0)

    // 대금지급 전표 (PAYMENT 타입) 조회
    const vouchers = await prisma.voucher.findMany({
      where: {
        voucherType: 'PAYMENT',
        voucherDate: { gte: startDate, lte: endDate },
        status: { in: ['APPROVED', 'CONFIRMED'] },
      },
      include: {
        details: {
          include: {
            partner: { select: { id: true, partnerCode: true, partnerName: true } },
            accountSubject: { select: { code: true, nameKo: true } },
          },
        },
        createdBy: { select: { nameKo: true } },
      },
      orderBy: { voucherDate: 'desc' },
    })

    const result = vouchers.map((v) => {
      // 거래처 추출 (전표 상세에서 거래처가 있는 항목)
      const partnerDetail = v.details.find((d) => d.partner)
      return {
        id: v.id,
        voucherNo: v.voucherNo,
        voucherDate: v.voucherDate,
        description: v.description,
        totalAmount: Number(v.totalDebit),
        status: v.status,
        createdBy: v.createdBy.nameKo,
        partner: partnerDetail?.partner
          ? {
              id: partnerDetail.partner.id,
              partnerCode: partnerDetail.partner.partnerCode,
              partnerName: partnerDetail.partner.partnerName,
            }
          : null,
        details: v.details.map((d) => ({
          account: d.accountSubject.nameKo,
          debit: Number(d.debitAmount),
          credit: Number(d.creditAmount),
          description: d.description,
        })),
      }
    })

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
