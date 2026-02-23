import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  requirePermissionCheck,
  isErrorResponse,
} from '@/lib/api-helpers'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requirePermissionCheck('hr', 'delete')
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employees: true,
            children: true,
          },
        },
      },
    })

    if (!department) return errorResponse('부서를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (department._count.children > 0) {
      return errorResponse('하위 부서가 존재하여 삭제할 수 없습니다.', 'HAS_CHILDREN', 400)
    }

    if (department._count.employees > 0) {
      return errorResponse('소속 사원이 존재하여 삭제할 수 없습니다.', 'HAS_EMPLOYEES', 400)
    }

    await prisma.department.delete({ where: { id } })

    return successResponse({ message: '부서가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
