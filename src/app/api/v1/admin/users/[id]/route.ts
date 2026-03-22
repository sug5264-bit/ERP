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

    // 자기 자신을 비활성화하는 것을 방지
    if (validated.isActive === false && id === authResult.session.user.id) {
      return errorResponse('자기 자신을 비활성화할 수 없습니다.', 'SELF_DEACTIVATE', 400)
    }

    // 비밀번호 해싱은 트랜잭션 밖에서 수행 (CPU-bound)
    let passwordHash: string | undefined
    if (validated.password) passwordHash = await hash(validated.password, 12)

    const user = await prisma.$transaction(async (tx) => {
      // username/email 유니크 체크 (트랜잭션 내에서 race condition 방지)
      if (validated.username) {
        const existingUser = await tx.user.findFirst({
          where: { username: validated.username, id: { not: id } },
        })
        if (existingUser) throw new Error('CONFLICT:이미 사용 중인 사용자명입니다.')
      }
      if (validated.email) {
        const existingUser = await tx.user.findFirst({
          where: { email: validated.email, id: { not: id } },
        })
        if (existingUser) throw new Error('CONFLICT:이미 사용 중인 이메일입니다.')
      }

      const updateData: Record<string, unknown> = {}
      if (validated.username !== undefined) updateData.username = validated.username
      if (validated.email !== undefined) updateData.email = validated.email
      if (validated.name !== undefined) updateData.name = validated.name
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive
      if (passwordHash) updateData.passwordHash = passwordHash
      if (validated.employeeId !== undefined) updateData.employeeId = validated.employeeId

      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        include: { employee: true },
      })

      // 소속(부서/직위) 변경
      if ((validated.departmentId !== undefined || validated.positionId !== undefined) && updated.employeeId) {
        const employeeUpdateData: Record<string, unknown> = {}
        if (validated.departmentId !== undefined) employeeUpdateData.departmentId = validated.departmentId
        if (validated.positionId !== undefined) employeeUpdateData.positionId = validated.positionId
        await tx.employee.update({
          where: { id: updated.employeeId },
          data: employeeUpdateData,
        })
      }

      if (validated.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } })
        await tx.userRole.createMany({
          data: validated.roleIds.map((roleId) => ({ userId: id, roleId })),
        })
      }

      return updated
    })

    return successResponse({ id: user.id, email: user.email, name: user.name })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
      return errorResponse(error.message.slice(9), 'CONFLICT', 409)
    }
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

    // 마지막 관리자 비활성화 방지
    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: { select: { name: true } } } } },
    })
    if (!targetUser) return errorResponse('사용자를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const isAdmin = targetUser.userRoles.some((ur) => ur.role.name === 'SYSTEM_ADMIN' || ur.role.name === '관리자')
    if (isAdmin) {
      const activeAdminCount = await prisma.user.count({
        where: {
          isActive: true,
          userRoles: { some: { role: { name: { in: ['SYSTEM_ADMIN', '관리자'] } } } },
        },
      })
      if (activeAdminCount <= 1) {
        return errorResponse('마지막 관리자는 비활성화할 수 없습니다.', 'LAST_ADMIN', 400)
      }
    }

    // 비활성화로 처리 (역할 포함 연관 데이터 보존)
    await prisma.user.update({ where: { id }, data: { isActive: false } })

    return successResponse({ message: '사용자가 비활성화되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
