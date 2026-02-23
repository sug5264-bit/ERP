import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: { include: { permission: { select: { id: true, module: true, action: true } } } },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    })

    const data = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.userRoles,
      permissions: r.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        action: rp.permission.action,
      })),
    }))

    return successResponse(data, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const { name, description, permissionIds } = body

    if (!name) return errorResponse('역할명은 필수입니다.', 'VALIDATION_ERROR', 400)

    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing) return errorResponse('이미 존재하는 역할명입니다.', 'CONFLICT', 409)

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        rolePermissions:
          Array.isArray(permissionIds) && permissionIds.length > 0
            ? { create: permissionIds.map((permissionId: string) => ({ permissionId })) }
            : undefined,
      },
      include: {
        rolePermissions: {
          include: { permission: { select: { id: true, module: true, action: true } } },
        },
        _count: { select: { userRoles: true } },
      },
    })

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
