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

    // Cascade delete in a transaction
    await prisma.$transaction(async (tx) => {
      if (note.relatedTable === 'SalesOrder') {
        // Find mirrored DeliveryPost notes (relatedId = this note's id)
        const mirroredNotes = await tx.note.findMany({
          where: { relatedTable: 'DeliveryPost', relatedId: id },
        })

        for (const mirrored of mirroredNotes) {
          // Find replies to the mirrored note
          const replies = await tx.note.findMany({
            where: { relatedTable: 'DeliveryReply', relatedId: mirrored.id },
            select: { id: true },
          })
          const replyIds = replies.map((r) => r.id)

          // Delete reply attachments
          if (replyIds.length > 0) {
            await tx.attachment.deleteMany({
              where: { relatedTable: 'DeliveryReplyPost', relatedId: { in: replyIds } },
            })
          }

          // Delete replies
          await tx.note.deleteMany({
            where: { relatedTable: 'DeliveryReply', relatedId: mirrored.id },
          })
        }

        // Delete mirrored DeliveryPost notes
        await tx.note.deleteMany({
          where: { relatedTable: 'DeliveryPost', relatedId: id },
        })

        // Delete this note's attachments (SalesOrderPost)
        await tx.attachment.deleteMany({
          where: { relatedTable: 'SalesOrderPost', relatedId: id },
        })
      }

      // Delete the note itself
      await tx.note.delete({ where: { id } })
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
