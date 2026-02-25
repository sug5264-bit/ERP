import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createDepartmentSchema } from '@/lib/validations/hr'
import { successResponse, errorResponse, handleApiError, requirePermissionCheck, isErrorResponse } from '@/lib/api-helpers'

export async function GET() {
  try {
    const authResult = await requirePermissionCheck('hr', 'read')
    if (isErrorResponse(authResult)) return authResult

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    })

    return successResponse(departments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requirePermissionCheck('hr', 'create')
    if (isErrorResponse(authResult)) return authResult

    const body = await req.json()
    const validated = createDepartmentSchema.parse(body)

    let level = 1
    if (validated.parentId) {
      const parent = await prisma.department.findUnique({ where: { id: validated.parentId } })
      if (!parent) return errorResponse('상위 부서를 찾을 수 없습니다.', 'NOT_FOUND', 404)
      level = parent.level + 1
    }

    const dept = await prisma.department.create({
      data: { ...validated, level },
    })

    return successResponse(dept)
  } catch (error) {
    return handleApiError(error)
  }
}
