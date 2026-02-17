import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createDepartmentSchema } from '@/lib/validations/hr'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    })

    return successResponse(departments, undefined, { cache: 's-maxage=300, stale-while-revalidate=600' })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const body = await req.json()
    const validated = createDepartmentSchema.parse(body)

    const level = validated.parentId
      ? ((await prisma.department.findUnique({ where: { id: validated.parentId } }))?.level ?? 0) + 1
      : 1

    const dept = await prisma.department.create({
      data: { ...validated, level },
    })

    return successResponse(dept)
  } catch (error) {
    return handleApiError(error)
  }
}
