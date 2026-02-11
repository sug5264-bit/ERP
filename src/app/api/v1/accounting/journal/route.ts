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

// 분개장: 전표의 개별 분개 내역 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountSubjectId = searchParams.get('accountSubjectId')

    const where: any = {}
    if (accountSubjectId) where.accountSubjectId = accountSubjectId
    if (startDate || endDate) {
      where.voucher = { voucherDate: {} }
      if (startDate) where.voucher.voucherDate.gte = new Date(startDate)
      if (endDate) where.voucher.voucherDate.lte = new Date(endDate)
    }

    const [details, totalCount] = await Promise.all([
      prisma.voucherDetail.findMany({
        where,
        include: {
          voucher: {
            select: {
              voucherNo: true,
              voucherDate: true,
              voucherType: true,
              description: true,
              status: true,
            },
          },
          accountSubject: {
            select: { code: true, nameKo: true, accountType: true },
          },
          partner: { select: { partnerName: true } },
        },
        skip,
        take: pageSize,
        orderBy: [
          { voucher: { voucherDate: 'desc' } },
          { lineNo: 'asc' },
        ],
      }),
      prisma.voucherDetail.count({ where }),
    ])

    return successResponse(details, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
