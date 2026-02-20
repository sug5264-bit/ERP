import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createEmployeeSchema } from '@/lib/validations/hr'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
  getPaginationParams,
  buildMeta,
} from '@/lib/api-helpers'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { searchParams } = req.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const search = searchParams.get('search') || ''
    const departmentId = searchParams.get('departmentId')
    const status = searchParams.get('status')

    const where: any = {}
    if (search) {
      where.OR = [
        { nameKo: { contains: search, mode: 'insensitive' } },
        { employeeNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status

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

    return successResponse(employees, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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

    // 자동으로 사용자 계정 생성
    const bcrypt = await import('bcryptjs')
    const defaultPassword = await bcrypt.default.hash('user1234', 10)
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
      console.error('Auto user creation failed:', userErr)
    }

    return successResponse(employee)
  } catch (error) {
    return handleApiError(error)
  }
}
