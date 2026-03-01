import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'
import { generateDocumentNumber } from '@/lib/doc-number'
import { createNettingSchema } from '@/lib/validations/sales'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = new URL(req.url)
    const now = new Date()
    let year = parseInt(searchParams.get('year') || String(now.getFullYear())) || now.getFullYear()
    let month = parseInt(searchParams.get('month') || String(now.getMonth() + 1)) || now.getMonth() + 1
    // 범위 검증
    if (year < 2000 || year > 2100) year = now.getFullYear()
    if (month < 1 || month > 12) month = now.getMonth() + 1

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)

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
    const partnerMap: Record<
      string,
      {
        partnerId: string
        partnerCode: string
        partnerName: string
        receivable: number
        payable: number
        netAmount: number
        details: {
          voucherNo: string
          voucherDate: Date
          voucherType: string
          account: string
          debit: number
          credit: number
          description: string | null
        }[]
      }
    > = {}

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

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const data = createNettingSchema.parse(body)
    const { partnerId, amount, nettingDate, description } = data

    // 사전 검증
    const voucherDate = new Date(nettingDate)
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        startDate: { lte: voucherDate },
        endDate: { gte: voucherDate },
        isClosed: false,
      },
    })
    if (!fiscalYear) {
      return errorResponse('해당 일자의 활성 회계연도가 없습니다.', 'NO_FISCAL_YEAR')
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.session.user.id },
      select: { employeeId: true },
    })
    if (!user?.employeeId) {
      return errorResponse('사원 정보가 연결되어 있지 않습니다.', 'NO_EMPLOYEE')
    }

    // 매출채권(1100)과 매입채무(2100) 계정과목 조회
    const [accReceivable, accPayable] = await Promise.all([
      prisma.accountSubject.findUnique({ where: { code: '1100' } }),
      prisma.accountSubject.findUnique({ where: { code: '2100' } }),
    ])
    if (!accReceivable || !accPayable) {
      return errorResponse('계정과목을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    const parsedAmount = amount
    // 상계 전표를 트랜잭션으로 원자적 처리
    const voucher = await prisma.$transaction(async (tx) => {
      const voucherNo = await generateDocumentNumber('VOU', voucherDate, tx)
      return tx.voucher.create({
        data: {
          voucherNo,
          voucherDate,
          voucherType: 'TRANSFER',
          description: description || '상계 처리',
          totalDebit: parsedAmount,
          totalCredit: parsedAmount,
          fiscalYearId: fiscalYear.id,
          createdById: user!.employeeId!,
          details: {
            create: [
              {
                lineNo: 1,
                accountSubjectId: accPayable.id,
                debitAmount: parsedAmount,
                creditAmount: 0,
                partnerId,
                description: '매입채무 상계',
              },
              {
                lineNo: 2,
                accountSubjectId: accReceivable.id,
                debitAmount: 0,
                creditAmount: parsedAmount,
                partnerId,
                description: '매출채권 상계',
              },
            ],
          },
        },
        include: {
          details: { include: { accountSubject: true, partner: true } },
        },
      })
    })

    return successResponse(voucher)
  } catch (error) {
    return handleApiError(error)
  }
}
