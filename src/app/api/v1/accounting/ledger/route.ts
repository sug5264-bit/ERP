import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

// 총계정원장: 계정과목별 집계 + 거래내역
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { searchParams } = request.nextUrl
    const accountSubjectId = searchParams.get('accountSubjectId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 계정과목별 집계 보기 (선택 없을 때)
    if (!accountSubjectId) {
      const voucherDateWhere: any = {}
      if (startDate) voucherDateWhere.gte = new Date(startDate)
      if (endDate) voucherDateWhere.lte = new Date(endDate)

      // groupBy 단일 쿼리로 모든 계정과목 집계 (N+1 → 1 쿼리)
      const [accounts, aggs] = await Promise.all([
        prisma.accountSubject.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        }),
        prisma.voucherDetail.groupBy({
          by: ['accountSubjectId'],
          where: {
            voucher: {
              status: { in: ['APPROVED', 'CONFIRMED'] },
              ...(startDate || endDate ? { voucherDate: voucherDateWhere } : {}),
            },
          },
          _sum: { debitAmount: true, creditAmount: true },
        }),
      ])

      const aggMap = new Map(aggs.map(a => [a.accountSubjectId, a._sum]))

      const filtered = accounts
        .map(account => {
          const sums = aggMap.get(account.id)
          return {
            ...account,
            totalDebit: sums?.debitAmount || 0,
            totalCredit: sums?.creditAmount || 0,
          }
        })
        .filter(r => Number(r.totalDebit) !== 0 || Number(r.totalCredit) !== 0)

      return successResponse(filtered)
    }

    // 특정 계정과목의 거래내역 보기 (페이지네이션 적용)
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const dateWhere: any = {}
    if (startDate || endDate) {
      dateWhere.voucherDate = {}
      if (startDate) dateWhere.voucherDate.gte = new Date(startDate)
      if (endDate) dateWhere.voucherDate.lte = new Date(endDate)
    }

    const detailWhere = {
      accountSubjectId,
      voucher: {
        status: { in: ['APPROVED', 'CONFIRMED'] as const },
        ...dateWhere,
      },
    }

    const [details, totalCount, account] = await Promise.all([
      prisma.voucherDetail.findMany({
        where: detailWhere,
        include: {
          voucher: {
            select: {
              voucherNo: true,
              voucherDate: true,
              voucherType: true,
              description: true,
            },
          },
          partner: { select: { partnerName: true } },
        },
        orderBy: { voucher: { voucherDate: 'asc' } },
        skip,
        take: pageSize,
      }),
      prisma.voucherDetail.count({ where: detailWhere }),
      prisma.accountSubject.findUnique({
        where: { id: accountSubjectId },
      }),
    ])

    return successResponse({ account, details }, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
