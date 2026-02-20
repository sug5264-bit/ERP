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
import { createVoucherSchema } from '@/lib/validations/accounting'
import { generateDocumentNumber } from '@/lib/doc-number'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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
      where.OR = [
        { voucherNo: { contains: search } },
        { description: { contains: search, mode: 'insensitive' } },
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
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await request.json()
    const data = createVoucherSchema.parse(body)

    // Resolve accountCode to accountSubjectId if needed
    const resolvedDetails = await Promise.all(
      data.details.map(async (d) => {
        let accountSubjectId = d.accountSubjectId
        if (!accountSubjectId && (d as any).accountCode) {
          const acc = await prisma.accountSubject.findUnique({ where: { code: (d as any).accountCode } })
          if (!acc) throw new Error(`계정과목 코드 ${(d as any).accountCode}를 찾을 수 없습니다.`)
          accountSubjectId = acc.id
        }
        return { ...d, accountSubjectId: accountSubjectId! }
      })
    )

    // 차/대변 합계 검증
    const totalDebit = resolvedDetails.reduce((sum, d) => sum + d.debitAmount, 0)
    const totalCredit = resolvedDetails.reduce((sum, d) => sum + d.creditAmount, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
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
      where: { id: session.user.id },
      select: { employeeId: true },
    })
    if (!user?.employeeId) {
      return errorResponse('사원 정보가 연결되어 있지 않습니다.', 'NO_EMPLOYEE')
    }

    const voucherNo = await generateDocumentNumber('VOU', voucherDate)

    const voucher = await prisma.voucher.create({
      data: {
        voucherNo,
        voucherDate,
        voucherType: data.voucherType,
        description: data.description,
        totalDebit,
        totalCredit,
        fiscalYearId: fiscalYear.id,
        createdById: user.employeeId,
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

    return successResponse(voucher)
  } catch (error) {
    return handleApiError(error)
  }
}
