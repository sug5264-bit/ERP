import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, handleApiError, requireAuth, isErrorResponse, successResponse } from '@/lib/api-helpers'
import { logger } from '@/lib/logger'
import { downloadFile, deleteFile, SHIPPER_BUCKET } from '@/lib/supabase-storage'

function getBucket(relatedTable: string): string | undefined {
  return relatedTable === 'ShipperOrderAttachment' ? SHIPPER_BUCKET : undefined
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) {
      return errorResponse('파일을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    // SHIPPER 계정은 자신의 화주사 첨부파일만 다운로드 가능
    const accountType = authResult.session.user.accountType
    if (accountType === 'SHIPPER' && attachment.relatedTable !== 'ShipperOrderAttachment') {
      return errorResponse('접근 권한이 없습니다.', 'FORBIDDEN', 403)
    }

    const bucket = getBucket(attachment.relatedTable)
    let fileBuffer: Buffer
    try {
      fileBuffer = await downloadFile(attachment.filePath, bucket)
    } catch (err) {
      logger.error('File not found in storage', {
        path: attachment.filePath,
        attachmentId: id,
        error: err instanceof Error ? err.message : err,
      })
      return errorResponse('파일이 서버에 존재하지 않습니다. 관리자에게 문의하세요.', 'FILE_NOT_FOUND', 404)
    }

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename="${attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        'Content-Length': String(fileBuffer.length),
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

    // Delete file from Supabase Storage
    const delBucket = getBucket(attachment.relatedTable)
    try {
      await deleteFile(attachment.filePath, delBucket)
    } catch (err) {
      logger.error('Failed to delete attachment from storage', {
        path: attachment.filePath,
        error: err instanceof Error ? err.message : err,
      })
    }

    await prisma.attachment.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
