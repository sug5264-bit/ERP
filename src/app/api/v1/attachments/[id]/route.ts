import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, handleApiError, requireAuth, isErrorResponse, successResponse } from '@/lib/api-helpers'
import { readFile, unlink } from 'fs/promises'
import { join, resolve } from 'path'

const UPLOAD_DIR = resolve(process.cwd(), 'uploads', 'attachments')

/** 경로 순회 방지: 최종 경로가 UPLOAD_DIR 안에 있는지 검증 */
function safePath(fileName: string): string {
  const full = resolve(UPLOAD_DIR, fileName)
  if (!full.startsWith(UPLOAD_DIR)) {
    throw new Error('잘못된 파일 경로입니다.')
  }
  return full
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

    const filePath = safePath(attachment.filePath)
    const fileBuffer = await readFile(filePath)

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        'Content-Length': String(attachment.fileSize),
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

    // Delete file from filesystem
    const filePath = safePath(attachment.filePath)
    try {
      await unlink(filePath)
    } catch {
      // File may already be deleted
    }

    await prisma.attachment.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
