import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'
import { createVoucherSchema } from '@/lib/validations/accounting'
import { generateDocumentNumber } from '@/lib/doc-number'
import { sanitizeSearchQuery } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const voucherType = searchParams.get('voucherType')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')

    const where: any = {}
    if (voucherType) where.voucherType = voucherType
    if (status) where.status = status
    if (startDate || endDate) {
      where.voucherDate = {}
      if (startDate) where.voucherDate.gte = new Date(startDate)
      if (endDate) where.voucherDate.lte = new Date(endDate)
    }
    if (search) {
      const sanitized = sanitizeSearchQuery(search)
      where.OR = [
        { voucherNo: { contains: sanitized, mode: 'insensitive' } },
        { description: { contains: sanitized, mode: 'insensitive' } },
      ]
    }

    const [vouchers, totalCount] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          createdBy: { select: { nameKo: true } },
          approvedBy: { select: { nameKo: true } },
          _count: { select: { details: true } },
        },
        skip,
        take: pageSize,
        orderBy: { voucherDate: 'desc' },
      }),
      prisma.voucher.count({ where }),
    ])

    return successResponse(vouchers, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createVoucherSchema.parse(body)

    // Resolve accountCode to accountSubjectId if needed (배치 조회로 N+1 방지)
    const accountCodes = data.details
      .filter((d) => !d.accountSubjectId && (d as any).accountCode)
      .map((d) => (d as any).accountCode as string)
    const accountCodeMap = new Map<string, string>()
    if (accountCodes.length > 0) {
      const accounts = await prisma.accountSubject.findMany({
        where: { code: { in: accountCodes } },
        select: { id: true, code: true },
      })
      for (const acc of accounts) accountCodeMap.set(acc.code, acc.id)
      const missing = accountCodes.filter((c) => !accountCodeMap.has(c))
      if (missing.length > 0) {
        return errorResponse(`계정과목 코드를 찾을 수 없습니다: ${missing.join(', ')}`, 'ACCOUNT_NOT_FOUND')
      }
    }
    const resolvedDetails = data.details.map((d) => {
      const accountSubjectId = d.accountSubjectId || accountCodeMap.get((d as any).accountCode)
      return { ...d, accountSubjectId: accountSubjectId! }
    })

    // 차/대변 합계 검증 (정수 연산으로 부동소수점 오차 제거)
    const totalDebit = resolvedDetails.reduce((sum, d) => sum + Math.round(d.debitAmount * 100), 0) / 100
    const totalCredit = resolvedDetails.reduce((sum, d) => sum + Math.round(d.creditAmount * 100), 0) / 100
    if (totalDebit !== totalCredit) {
      return errorResponse('차변과 대변의 합계가 일치하지 않습니다.', 'BALANCE_ERROR')
    }

    // 활성 회계연도 조회
    const voucherDate = new Date(data.voucherDate)
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

    // 작성자 Employee 조회
    const user = await prisma.user.findUnique({
      where: { id: authResult.session.user.id },
      select: { employeeId: true },
    })
    if (!user?.employeeId) {
      return errorResponse('사원 정보가 연결되어 있지 않습니다.', 'NO_EMPLOYEE')
    }

    // 전표번호 생성 + 전표 저장을 트랜잭션으로 원자적 처리
    const voucher = await prisma.$transaction(async (tx) => {
      const voucherNo = await generateDocumentNumber('VOU', voucherDate)
      return tx.voucher.create({
        data: {
          voucherNo,
          voucherDate,
          voucherType: data.voucherType,
          description: data.description,
          totalDebit,
          totalCredit,
          fiscalYearId: fiscalYear.id,
          createdById: user!.employeeId!,
          details: {
            create: resolvedDetails.map((d, idx) => ({
              lineNo: idx + 1,
              accountSubjectId: d.accountSubjectId,
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
  } catch (error) {
    return handleApiError(error)
  }
}
