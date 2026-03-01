import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, module: true, action: true } } },
        },
        _count: { select: { userRoles: true } },
      },
    })

    if (!role) return errorResponse('역할을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    return successResponse({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
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
    const { name, description, permissionIds } = body

    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) return errorResponse('역할을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (role.isSystem) return errorResponse('시스템 역할은 수정할 수 없습니다.', 'FORBIDDEN', 403)

    // 역할 기본 정보 + 권한 재할당을 트랜잭션으로 원자적 처리
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description

    await prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: updateData })

      if (Array.isArray(permissionIds)) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } })
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId: string) => ({
              roleId: id,
              permissionId,
            })),
          })
        }
      }
    })

    // 업데이트된 역할 반환
    const updated = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, module: true, action: true } } },
        },
        _count: { select: { userRoles: true } },
      },
    })

    return successResponse({
      id: updated!.id,
      name: updated!.name,
      description: updated!.description,
      isSystem: updated!.isSystem,
      userCount: updated!._count.userRoles,
      permissions: updated!.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { userRoles: true } } },
    })
    if (!role) return errorResponse('역할을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    if (role.isSystem) return errorResponse('시스템 역할은 삭제할 수 없습니다.', 'FORBIDDEN', 403)
    if (role._count.userRoles > 0) {
      return errorResponse('해당 역할에 할당된 사용자가 있어 삭제할 수 없습니다.', 'CONFLICT', 409)
    }

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      await tx.role.delete({ where: { id } })
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
