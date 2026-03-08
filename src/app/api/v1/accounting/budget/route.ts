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
import { createBudgetSchema } from '@/lib/validations/accounting'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'read')
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const fiscalYearId = sp.get('fiscalYearId')
    const departmentId = sp.get('departmentId')

    const where: Record<string, unknown> = {}
    if (fiscalYearId) where.fiscalYearId = fiscalYearId
    if (departmentId) where.departmentId = departmentId

    const [budgets, totalCount] = await Promise.all([
      prisma.budgetHeader.findMany({
        where,
        include: {
          fiscalYear: { select: { year: true } },
          department: { select: { name: true } },
          details: {
            include: {
              accountSubject: { select: { code: true, nameKo: true } },
            },
          },
        },
        orderBy: { department: { name: 'asc' } },
        skip,
        take: pageSize,
      }),
      prisma.budgetHeader.count({ where }),
    ])

    return successResponse(budgets, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('accounting', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await request.json()
    const data = createBudgetSchema.parse(body)

    const existing = await prisma.budgetHeader.findUnique({
      where: {
        fiscalYearId_departmentId: {
          fiscalYearId: data.fiscalYearId,
          departmentId: data.departmentId,
        },
      },
    })
    if (existing) {
      return errorResponse('이미 해당 연도/부서의 예산이 존재합니다.', 'DUPLICATE', 409)
    }

    const budget = await prisma.budgetHeader.create({
      data: {
        fiscalYearId: data.fiscalYearId,
        departmentId: data.departmentId,
        details: {
          create: data.details.map((d) => {
            const total =
              d.month01 +
              d.month02 +
              d.month03 +
              d.month04 +
              d.month05 +
              d.month06 +
              d.month07 +
              d.month08 +
              d.month09 +
              d.month10 +
              d.month11 +
              d.month12
            return {
              accountSubjectId: d.accountSubjectId,
              month01: d.month01,
              month02: d.month02,
              month03: d.month03,
              month04: d.month04,
              month05: d.month05,
              month06: d.month06,
              month07: d.month07,
              month08: d.month08,
              month09: d.month09,
              month10: d.month10,
              month11: d.month11,
              month12: d.month12,
              totalAmount: total,
            }
          }),
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

    return successResponse(budget)
  } catch (error) {
    return handleApiError(error)
  }
}
