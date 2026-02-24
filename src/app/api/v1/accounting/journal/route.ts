import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

// 분개장: 전표의 개별 분개 내역 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const accountSubjectId = searchParams.get('accountSubjectId')

    const where: any = {}
    if (accountSubjectId) where.accountSubjectId = accountSubjectId
    if (startDate || endDate) {
      where.voucher = { voucherDate: {} }
      if (startDate) {
        const d = new Date(startDate)
        if (!isNaN(d.getTime())) where.voucher.voucherDate.gte = d
      }
      if (endDate) {
        const d = new Date(endDate)
        if (!isNaN(d.getTime())) where.voucher.voucherDate.lte = d
      }
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
        orderBy: [{ voucher: { voucherDate: 'desc' } }, { lineNo: 'asc' }],
      }),
      prisma.voucherDetail.count({ where }),
    ])

    return successResponse(details, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}
