import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const note = await prisma.note.findUnique({ where: { id } })
    if (!note) {
      return errorResponse('메모를 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    if (note.createdBy !== authResult.session.user.id) {
      return errorResponse('본인이 작성한 메모만 수정할 수 있습니다.', 'FORBIDDEN', 403)
    }

    const body = await request.json()
    const { content } = body
    if (!content?.trim()) {
      return errorResponse('내용을 입력해주세요.', 'VALIDATION_ERROR', 400)
    }

    const updated = await prisma.note.update({
      where: { id },
      data: { content: content.trim() },
    })

    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

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

    // Cascade: if this is a SalesOrder note, also delete mirrored DeliveryPost notes
    if (note.relatedTable === 'SalesOrder') {
      // The mirrored DeliveryPost note has relatedId = this note's id
      const mirroredNotes = await prisma.note.findMany({
        where: { relatedTable: 'DeliveryPost', relatedId: id },
      })
      for (const mirrored of mirroredNotes) {
        // Delete replies to the mirrored note
        await prisma.note.deleteMany({
          where: { relatedTable: 'DeliveryReply', relatedId: mirrored.id },
        })
      }
      await prisma.note.deleteMany({
        where: { relatedTable: 'DeliveryPost', relatedId: id },
      })
    }

    await prisma.note.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
