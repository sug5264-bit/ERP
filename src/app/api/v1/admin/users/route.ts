import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { createUserSchema } from '@/lib/validations/admin'
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

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, username: true, email: true, name: true,
          isActive: true, lastLoginAt: true, createdAt: true,
          userRoles: { select: { role: { select: { id: true, name: true, description: true } } } },
          employee: {
            select: {
              id: true, employeeNo: true, nameKo: true,
              department: { select: { name: true } },
              position: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    const data = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ur.role),
      employee: u.employee
        ? {
            id: u.employee.id,
            employeeNo: u.employee.employeeNo,
            nameKo: u.employee.nameKo,
            department: u.employee.department?.name,
            position: u.employee.position?.name,
          }
        : null,
    }))

    return successResponse(data, buildMeta(page, pageSize, totalCount))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const validated = createUserSchema.parse(body)

    const existingUsername = await prisma.user.findUnique({
      where: { username: validated.username },
    })
    if (existingUsername) {
      return errorResponse('이미 존재하는 아이디입니다.', 'DUPLICATE_USERNAME', 409)
    }

    const existingEmail = await prisma.user.findUnique({
      where: { email: validated.email },
    })
    if (existingEmail) {
      return errorResponse('이미 존재하는 이메일입니다.', 'DUPLICATE_EMAIL', 409)
    }

    const passwordHash = await hash(validated.password, 12)

    const user = await prisma.user.create({
      data: {
        username: validated.username,
        email: validated.email,
        passwordHash,
        name: validated.name,
        employeeId: validated.employeeId || null,
        userRoles: {
          create: validated.roleIds.map((roleId) => ({ roleId })),
        },
      },
      include: {
        userRoles: { include: { role: true } },
      },
    })

    return successResponse(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.userRoles.map((ur) => ur.role.name),
      },
      undefined
    )
  } catch (error) {
    return handleApiError(error)
  }
}
