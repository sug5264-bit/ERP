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
      return errorResponse('게시글을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    await prisma.note.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
