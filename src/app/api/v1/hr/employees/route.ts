import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmployeeSchema } from '@/lib/validations/hr'
import { hasPermission } from '@/lib/rbac'
import { sanitizeSearchQuery } from '@/lib/sanitize'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

/** 민감한 개인정보 필드를 목록에서 제거 */
const SENSITIVE_FIELDS = ['phone', 'birthDate', 'bankName', 'bankAccount', 'address', 'gender'] as const
function stripSensitiveFields(employee: Record<string, unknown>) {
  const result = { ...employee }
  for (const field of SENSITIVE_FIELDS) delete result[field]
  return result
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult

    // HR 세부 모듈 권한 확인 (민감 정보 열람용)
    const { session } = authResult
    const canViewSensitive = hasPermission(session.user.permissions, session.user.roles, 'hr.employees', 'read')

    const { searchParams } = req.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const rawSearch = searchParams.get('search') || ''
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (rawSearch) {
      const search = sanitizeSearchQuery(rawSearch)
      where.OR = [
        { nameKo: { contains: search, mode: 'insensitive' } },
        { employeeNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status
    const employeeType = searchParams.get('employeeType')
    if (employeeType) where.employeeType = employeeType
    const joinDateFrom = searchParams.get('joinDateFrom')
    const joinDateTo = searchParams.get('joinDateTo')
    if (joinDateFrom || joinDateTo) {
      const dateRange: { gte?: Date; lte?: Date } = {}
      if (joinDateFrom) {
        const d = new Date(joinDateFrom)
        if (!isNaN(d.getTime())) dateRange.gte = d
      }
      if (joinDateTo) {
        const d = new Date(joinDateTo)
        if (!isNaN(d.getTime())) dateRange.lte = d
      }
      where.joinDate = dateRange
    }

    const [employees, totalCount] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
        },
        orderBy: { employeeNo: 'asc' },
        skip,
        take: pageSize,
      }),
      prisma.employee.count({ where }),
    ])

    // 민감한 개인정보는 HR 세부 권한이 있는 사용자에게만 표시
    const data = canViewSensitive
      ? employees
      : employees.map((e) => stripSensitiveFields(e as unknown as Record<string, unknown>))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const validated = createEmployeeSchema.parse(body)

    const existing = await prisma.employee.findUnique({
      where: { employeeNo: validated.employeeNo },
    })
    if (existing) {
      return errorResponse('이미 존재하는 사번입니다.', 'DUPLICATE_EMPLOYEE_NO', 409)
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNo: validated.employeeNo,
        nameKo: validated.nameKo,
        nameEn: validated.nameEn,
        departmentId: validated.departmentId,
        positionId: validated.positionId,
        joinDate: new Date(validated.joinDate),
        employeeType: validated.employeeType,
        email: validated.email || null,
        phone: validated.phone,
        address: validated.address,
        bankName: validated.bankName,
        bankAccount: validated.bankAccount,
        gender: validated.gender,
        birthDate: validated.birthDate ? new Date(validated.birthDate) : null,
      },
      include: {
        department: true,
        position: true,
      },
    })

    // 자동으로 사용자 계정 생성 (랜덤 비밀번호 - 관리자가 재설정 필요)
    const crypto = await import('crypto')
    const bcrypt = await import('bcryptjs')
    const randomPassword = crypto.randomBytes(16).toString('base64url')
    const defaultPassword = await bcrypt.default.hash(randomPassword, 12)
    const username = validated.email
      ? validated.email.split('@')[0]
      : validated.employeeNo.toLowerCase().replace(/[^a-z0-9]/g, '')

    try {
      const existingUser = await prisma.user.findUnique({ where: { username } })
      if (!existingUser) {
        const newUser = await prisma.user.create({
          data: {
            username,
            email: validated.email || `${username}@company.com`,
            passwordHash: defaultPassword,
            name: validated.nameKo,
            isActive: true,
            employeeId: employee.id,
          },
        })
        // 일반사용자 역할 할당
        const userRole = await prisma.role.findFirst({ where: { name: '일반사용자' } })
        if (userRole) {
          await prisma.userRole.create({
            data: { userId: newUser.id, roleId: userRole.id },
          })
        }
      }
    } catch (userErr) {
      // 사용자 생성 실패해도 사원 등록은 유지
      const { logger } = await import('@/lib/logger')
      logger.error('Auto user creation failed', {
        error: userErr instanceof Error ? userErr.message : String(userErr),
        employeeId: employee.id,
      })
    }

    return successResponse(employee)
  } catch (error) {
    return handleApiError(error)
  }
}
