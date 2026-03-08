import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = new URL(req.url)
    const now = new Date()

    let startDate: Date
    let endDate: Date

    // startDate/endDate 직접 지정 시 우선 (일자별 조회)
    const rawStart = searchParams.get('startDate')
    const rawEnd = searchParams.get('endDate')
    if (rawStart) {
      const sd = new Date(rawStart)
      const ed = rawEnd ? new Date(rawEnd) : sd
      if (!isNaN(sd.getTime()) && !isNaN(ed.getTime())) {
        startDate = sd
        endDate = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 23, 59, 59, 999)
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      }
    } else {
      // year/month 기반 월별 조회 (기본)
      let year = parseInt(searchParams.get('year') || String(now.getFullYear())) || now.getFullYear()
      let month = parseInt(searchParams.get('month') || String(now.getMonth() + 1)) || now.getMonth() + 1
      if (year < 2000 || year > 2100) year = now.getFullYear()
      if (month < 1 || month > 12) month = now.getMonth() + 1
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0, 23, 59, 59, 999)
    }

    // 대금지급 전표 (PAYMENT 타입) 조회
    const vouchers = await prisma.voucher.findMany({
      where: {
        voucherType: 'PAYMENT',
        voucherDate: { gte: startDate, lte: endDate },
        status: { in: ['DRAFT', 'APPROVED', 'CONFIRMED'] },
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
        createdBy: v.createdBy?.nameKo || '(unknown)',
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
