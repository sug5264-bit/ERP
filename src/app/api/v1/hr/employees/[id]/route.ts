import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { updateEmployeeSchema } from '@/lib/validations/hr'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

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

    return successResponse(employee)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params
    const body = await req.json()
    const validated = updateEmployeeSchema.parse(body)

    const updateData: any = { ...validated }
    if (validated.joinDate) updateData.joinDate = new Date(validated.joinDate)
    if (validated.birthDate) updateData.birthDate = new Date(validated.birthDate)
    if (validated.resignDate) updateData.resignDate = new Date(validated.resignDate)

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params

    // 연결된 사용자 계정이 있는지 확인
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    })
    if (!employee) return errorResponse('사원을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    // 연결된 사용자 계정이 있으면 비활성화 처리
    if (employee.user) {
      await prisma.user.update({
        where: { id: employee.user.id },
        data: { isActive: false },
      })
    }

    await prisma.employee.delete({ where: { id } })

    return successResponse({ message: '사원이 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
