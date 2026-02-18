import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSession,
} from '@/lib/api-helpers'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return errorResponse('인증이 필요합니다.', 'UNAUTHORIZED', 401)

    const { id } = await params

    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true },
        },
      },
    })

    if (!position) return errorResponse('직급을 찾을 수 없습니다.', 'NOT_FOUND', 404)

    if (position._count.employees > 0) {
      return errorResponse('소속 사원이 존재하여 삭제할 수 없습니다.', 'HAS_EMPLOYEES', 400)
    }

    await prisma.position.delete({ where: { id } })

    return successResponse({ message: '직급이 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
