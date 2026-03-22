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
        // SalesOrder post → delete mirrored DeliveryPost, replies, statuses, and attachments
        const mirroredNotes = await tx.note.findMany({
          where: { relatedTable: 'DeliveryPost', relatedId: id },
        })

        for (const mirrored of mirroredNotes) {
          const replies = await tx.note.findMany({
            where: { relatedTable: 'DeliveryReply', relatedId: mirrored.id },
            select: { id: true },
          })
          const replyIds = replies.map((r) => r.id)

          if (replyIds.length > 0) {
            await tx.attachment.deleteMany({
              where: { relatedTable: 'DeliveryReplyPost', relatedId: { in: replyIds } },
            })
          }

          await tx.note.deleteMany({
            where: { relatedTable: 'DeliveryReply', relatedId: mirrored.id },
          })

          // Delete status tracking notes for this DeliveryPost
          await tx.note.deleteMany({
            where: { relatedTable: 'DeliveryPostStatus', relatedId: mirrored.id },
          })
        }

        await tx.note.deleteMany({
          where: { relatedTable: 'DeliveryPost', relatedId: id },
        })

        await tx.attachment.deleteMany({
          where: { relatedTable: 'SalesOrderPost', relatedId: id },
        })
      } else if (note.relatedTable === 'DeliveryPost') {
        // Reverse cascade: DeliveryPost → delete original SalesOrder post + everything
        const originalNoteId = note.relatedId // DeliveryPost.relatedId = original SalesOrder note ID

        // Delete replies to this DeliveryPost
        const replies = await tx.note.findMany({
          where: { relatedTable: 'DeliveryReply', relatedId: id },
          select: { id: true },
        })
        const replyIds = replies.map((r) => r.id)
        if (replyIds.length > 0) {
          await tx.attachment.deleteMany({
            where: { relatedTable: 'DeliveryReplyPost', relatedId: { in: replyIds } },
          })
        }
        await tx.note.deleteMany({
          where: { relatedTable: 'DeliveryReply', relatedId: id },
        })

        // Delete status tracking notes for this DeliveryPost
        await tx.note.deleteMany({
          where: { relatedTable: 'DeliveryPostStatus', relatedId: id },
        })

        // Delete attachments of the original SalesOrder post
        if (originalNoteId && originalNoteId !== 'GENERAL') {
          await tx.attachment.deleteMany({
            where: { relatedTable: 'SalesOrderPost', relatedId: originalNoteId },
          })

          // Delete the original SalesOrder note
          await tx.note.deleteMany({
            where: { id: originalNoteId, relatedTable: 'SalesOrder' },
          })

          // Delete any other mirrored DeliveryPost notes for the same original (excluding this one)
          const otherMirrors = await tx.note.findMany({
            where: { relatedTable: 'DeliveryPost', relatedId: originalNoteId, id: { not: id } },
            select: { id: true },
          })
          for (const mirror of otherMirrors) {
            const mirrorReplies = await tx.note.findMany({
              where: { relatedTable: 'DeliveryReply', relatedId: mirror.id },
              select: { id: true },
            })
            const mirrorReplyIds = mirrorReplies.map((r) => r.id)
            if (mirrorReplyIds.length > 0) {
              await tx.attachment.deleteMany({
                where: { relatedTable: 'DeliveryReplyPost', relatedId: { in: mirrorReplyIds } },
              })
            }
            await tx.note.deleteMany({
              where: { relatedTable: 'DeliveryReply', relatedId: mirror.id },
            })
            // Delete status tracking notes for this mirror
            await tx.note.deleteMany({
              where: { relatedTable: 'DeliveryPostStatus', relatedId: mirror.id },
            })
          }
          await tx.note.deleteMany({
            where: { relatedTable: 'DeliveryPost', relatedId: originalNoteId, id: { not: id } },
          })
        }
      }

      // Cascade delete for ShipperOrderPost (화주사 발주글)
      if (note.relatedTable === 'ShipperOrderPost') {
        // Find mirrored ShipperDeliveryPost
        const shipperDPs = await tx.note.findMany({
          where: { relatedTable: 'ShipperDeliveryPost', relatedId: id },
        })

        for (const dp of shipperDPs) {
          // Delete delivery replies + their attachments
          const dpReplies = await tx.note.findMany({
            where: { relatedTable: 'ShipperDeliveryReply', relatedId: dp.id },
            select: { id: true },
          })
          const dpReplyIds = dpReplies.map((r) => r.id)
          if (dpReplyIds.length > 0) {
            await tx.attachment.deleteMany({
              where: { relatedTable: 'ShipperDeliveryReplyPost', relatedId: { in: dpReplyIds } },
            })
          }
          await tx.note.deleteMany({
            where: { relatedTable: 'ShipperDeliveryReply', relatedId: dp.id },
          })
          // Delete delivery status
          await tx.note.deleteMany({
            where: { relatedTable: 'ShipperDeliveryPostStatus', relatedId: dp.id },
          })
        }

        // Delete delivery posts
        await tx.note.deleteMany({
          where: { relatedTable: 'ShipperDeliveryPost', relatedId: id },
        })

        // Delete order attachments
        await tx.attachment.deleteMany({
          where: { relatedTable: 'ShipperOrderAttachment', relatedId: id },
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
