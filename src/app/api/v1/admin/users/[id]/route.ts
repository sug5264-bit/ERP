import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { updateUserSchema } from '@/lib/validations/admin'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: { include: { role: true } },
        employee: { include: { department: true, position: true } },
      },
    })

    if (!user) return errorResponse('사용자를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    return successResponse({
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
      })),
      employee: user.employee,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const body = await req.json()
    const validated = updateUserSchema.parse(body)

    // username/email 유니크 체크
    if (validated.username) {
      const existingUser = await prisma.user.findFirst({
        where: { username: validated.username, id: { not: id } },
      })
      if (existingUser) return errorResponse('이미 사용 중인 사용자명입니다.', 'CONFLICT', 409)
    }
    if (validated.email) {
      const existingUser = await prisma.user.findFirst({
        where: { email: validated.email, id: { not: id } },
      })
      if (existingUser) return errorResponse('이미 사용 중인 이메일입니다.', 'CONFLICT', 409)
    }

    const updateData: any = {}
    if (validated.username !== undefined) updateData.username = validated.username
    if (validated.email !== undefined) updateData.email = validated.email
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive
    if (validated.password) updateData.passwordHash = await hash(validated.password, 12)
    if (validated.employeeId !== undefined) updateData.employeeId = validated.employeeId

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { employee: true },
    })

    // 소속(부서/직위) 변경
    if ((validated.departmentId !== undefined || validated.positionId !== undefined) && user.employeeId) {
      const employeeUpdateData: any = {}
      if (validated.departmentId !== undefined) employeeUpdateData.departmentId = validated.departmentId
      if (validated.positionId !== undefined) employeeUpdateData.positionId = validated.positionId
      await prisma.employee.update({
        where: { id: user.employeeId },
        data: employeeUpdateData,
      })
    }

    if (validated.roleIds) {
      await prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { userId: id } })
        await tx.userRole.createMany({
          data: validated.roleIds!.map((roleId) => ({ userId: id, roleId })),
        })
      })
    }

    return successResponse({ id: user.id, email: user.email, name: user.name })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    if (id === authResult.session.user.id) {
      return errorResponse('자기 자신을 삭제할 수 없습니다.', 'SELF_DELETE', 400)
    }

    // 비활성화로 처리 (연관 데이터 보존)
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } })
      await tx.user.update({ where: { id }, data: { isActive: false } })
    })

    return successResponse({ message: '사용자가 비활성화되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
