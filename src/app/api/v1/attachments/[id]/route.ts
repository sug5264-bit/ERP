import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, handleApiError, requireAuth, isErrorResponse, successResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { del } from '@vercel/blob'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) {
      return errorResponse('파일을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    // filePath는 Blob URL이므로 fetch로 가져옴
    let fileResponse: Response
    try {
      fileResponse = await fetch(attachment.filePath)
      if (!fileResponse.ok) throw new Error(`Blob fetch failed: ${fileResponse.status}`)
    } catch (err) {
      logger.error('File not found in blob storage', { url: attachment.filePath, attachmentId: id, error: err instanceof Error ? err.message : err })
      return errorResponse('파일이 서버에 존재하지 않습니다. 관리자에게 문의하세요.', 'FILE_NOT_FOUND', 404)
    }

    const fileBuffer = await fileResponse.arrayBuffer()

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        'Content-Length': String(fileBuffer.byteLength),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) {
      return errorResponse('파일을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    // 업로드한 사용자만 삭제 가능
    if (attachment.uploadedBy !== authResult.session.user.id) {
      return errorResponse('본인이 업로드한 파일만 삭제할 수 있습니다.', 'FORBIDDEN', 403)
    }

    // Delete file from blob storage
    try {
      await del(attachment.filePath)
    } catch (err) {
      logger.error('Failed to delete attachment from blob storage', { url: attachment.filePath, error: err instanceof Error ? err.message : err })
    }

    await prisma.attachment.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
