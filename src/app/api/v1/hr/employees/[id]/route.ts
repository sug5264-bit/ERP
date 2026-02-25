import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateEmployeeSchema } from '@/lib/validations/hr'
import { hasPermission } from '@/lib/rbac'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

/** 민감한 개인정보 필드 제거 (HR 세부 권한이 없는 사용자 대상) */
const SENSITIVE_FIELDS = ['phone', 'birthDate', 'bankName', 'bankAccount', 'address', 'gender'] as const
function stripSensitiveFields(data: Record<string, unknown>) {
  const result = { ...data }
  for (const field of SENSITIVE_FIELDS) delete result[field]
  return result
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        position: true,
        user: { select: { id: true, email: true, isActive: true } },
        leaveBalances: { where: { year: new Date().getFullYear() } },
        employeeHistories: { orderBy: { effectiveDate: 'desc' }, take: 10 },
      },
    })

    if (!employee) return errorResponse('사원을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // HR 세부 모듈 권한이 있는 사용자만 민감 개인정보 열람 가능
    const { session } = authResult
    const canViewSensitive = hasPermission(session.user.permissions, session.user.roles, 'hr.employees', 'read')

    const data = canViewSensitive ? employee : stripSensitiveFields(employee as unknown as Record<string, unknown>)

    return successResponse(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'update')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await req.json()
    const validated = updateEmployeeSchema.parse(body)

    const updateData: any = { ...validated }
    if (validated.joinDate !== undefined) updateData.joinDate = validated.joinDate ? new Date(validated.joinDate) : null
    if (validated.birthDate !== undefined) updateData.birthDate = validated.birthDate ? new Date(validated.birthDate) : null
    if (validated.resignDate !== undefined) updateData.resignDate = validated.resignDate ? new Date(validated.resignDate) : null

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: { department: true, position: true },
    })

    return successResponse(employee)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    // 연결된 사용자 계정이 있는지 확인
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    })
    if (!employee) return errorResponse('사원을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // 소프트 삭제: 사원 상태를 RESIGNED로 변경 (연관 데이터 보존)
    await prisma.$transaction(async (tx) => {
      // 연결된 사용자 계정 비활성화
      if (employee.user) {
        await tx.user.update({
          where: { id: employee.user.id },
          data: { isActive: false },
        })
      }
      await tx.employee.update({
        where: { id },
        data: { status: 'RESIGNED', resignDate: new Date() },
      })
    })

    return successResponse({ message: '사원이 비활성화되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
