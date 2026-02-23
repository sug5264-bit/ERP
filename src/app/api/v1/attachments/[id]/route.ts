import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { errorResponse, handleApiError, requireAuth, isErrorResponse, successResponse } from '@/lib/api-helpers'
import { readFile, unlink } from 'fs/promises'
import { join } from 'path'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'attachments')

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const attachment = await prisma.attachment.findUnique({ where: { id } })
    if (!attachment) {
      return errorResponse('파일을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    const filePath = join(UPLOAD_DIR, attachment.filePath)
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

    // Delete file from filesystem
    const filePath = join(UPLOAD_DIR, attachment.filePath)
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
