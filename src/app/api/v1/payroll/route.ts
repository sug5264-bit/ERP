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
import { createPayrollSchema } from '@/lib/validations/project'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult
    const sp = request.nextUrl.searchParams
    const { page, pageSize, skip } = getPaginationParams(sp)
    const [items, totalCount] = await Promise.all([
      prisma.payrollHeader.findMany({
        include: { _count: { select: { details: true } } },
        orderBy: { payDate: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.payrollHeader.count(),
    ])
    return successResponse(items, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult
    const body = await request.json()
    const data = createPayrollSchema.parse(body)

    // 전체 재직 사원 조회 (직급별 기본급 산정)
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, position: { select: { level: true } } },
    })

    // 직급별 기본급 매핑 (level 1=대표, 9=사원)
    const salaryByLevel: Record<number, number> = {
      1: 10000000,
      2: 8000000,
      3: 7000000,
      4: 6000000,
      5: 5000000,
      6: 4500000,
      7: 4000000,
      8: 3500000,
      9: 3000000,
    }

    const header = await prisma.$transaction(async (tx) => {
      const h = await tx.payrollHeader.create({
        data: { payPeriod: data.payPeriod, payDate: new Date(data.payDate) },
      })

      const detailsData = employees.map((emp) => {
        const base = salaryByLevel[emp.position?.level || 9] || 3000000
        const mealAllowance = 200000
        const transportAllowance = 200000
        const totalEarnings = base + mealAllowance + transportAllowance
        const nationalPension = Math.round(base * 0.045)
        const healthInsurance = Math.round(base * 0.03545)
        const longTermCare = Math.round(healthInsurance * 0.1281)
        const employmentInsurance = Math.round(base * 0.009)
        const incomeTax = Math.round(base * 0.03)
        const localIncomeTax = Math.round(incomeTax * 0.1)
        const totalDeductions =
          nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax
        const netPay = totalEarnings - totalDeductions
        return {
          payrollHeaderId: h.id,
          employeeId: emp.id,
          baseSalary: base,
          mealAllowance,
          transportAllowance,
          nationalPension,
          healthInsurance,
          longTermCare,
          employmentInsurance,
          incomeTax,
          localIncomeTax,
          totalEarnings,
          totalDeductions,
          netPay,
        }
      })

      await tx.payrollDetail.createMany({ data: detailsData })
      return h
    })

    return successResponse(header)
  } catch (error) {
    return handleApiError(error)
  }
}
