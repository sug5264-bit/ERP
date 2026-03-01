import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const note = await prisma.note.findUnique({ where: { id } })
    if (!note) {
      return errorResponse('메모를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    if (note.createdBy !== authResult.session.user.id) {
      return errorResponse('본인이 작성한 메모만 삭제할 수 있습니다.', 'FORBIDDEN', 403)
    }

    await prisma.note.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
