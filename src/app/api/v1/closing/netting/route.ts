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

    // 거래처별 매출채권(1100 debit)과 매입채무(2100 credit) 집계
    const details = await prisma.voucherDetail.findMany({
      where: {
        partnerId: { not: null },
        voucher: {
          voucherDate: { gte: startDate, lte: endDate },
          status: { in: ['APPROVED', 'CONFIRMED'] },
        },
        accountSubject: {
          code: { in: ['1100', '2100'] },
        },
      },
      include: {
        partner: { select: { id: true, partnerCode: true, partnerName: true } },
        accountSubject: { select: { code: true, nameKo: true } },
        voucher: { select: { voucherNo: true, voucherDate: true, voucherType: true } },
      },
    })

    // 거래처별 그룹화
    const partnerMap: Record<string, {
      partnerId: string
      partnerCode: string
      partnerName: string
      receivable: number
      payable: number
      netAmount: number
      details: any[]
    }> = {}

    for (const d of details) {
      if (!d.partner) continue
      const pid = d.partner.id
      if (!partnerMap[pid]) {
        partnerMap[pid] = {
          partnerId: pid,
          partnerCode: d.partner.partnerCode,
          partnerName: d.partner.partnerName,
          receivable: 0,
          payable: 0,
          netAmount: 0,
          details: [],
        }
      }

      const debit = Number(d.debitAmount)
      const credit = Number(d.creditAmount)

      if (d.accountSubject.code === '1100') {
        partnerMap[pid].receivable += debit - credit
      } else if (d.accountSubject.code === '2100') {
        partnerMap[pid].payable += credit - debit
      }

      partnerMap[pid].details.push({
        voucherNo: d.voucher.voucherNo,
        voucherDate: d.voucher.voucherDate,
        voucherType: d.voucher.voucherType,
        account: d.accountSubject.nameKo,
        debit: debit,
        credit: credit,
        description: d.description,
      })
    }

    // 순액 계산
    const result = Object.values(partnerMap).map((p) => ({
      ...p,
      netAmount: p.receivable - p.payable,
    }))

    return successResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}
