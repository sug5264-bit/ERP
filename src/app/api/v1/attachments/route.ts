import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'attachments')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const relatedTable = sp.get('relatedTable')
    const relatedId = sp.get('relatedId')

    if (!relatedTable || !relatedId) {
      return errorResponse('relatedTable과 relatedId가 필요합니다.', 'VALIDATION_ERROR')
    }

    const attachments = await prisma.attachment.findMany({
      where: { relatedTable, relatedId },
      orderBy: { createdAt: 'desc' },
    })

    return successResponse(attachments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const relatedTable = formData.get('relatedTable') as string
    const relatedId = formData.get('relatedId') as string

    if (!file || !relatedTable || !relatedId) {
      return errorResponse('file, relatedTable, relatedId가 필요합니다.', 'VALIDATION_ERROR')
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('파일 크기가 10MB를 초과합니다.', 'FILE_TOO_LARGE')
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    const ext = file.name.split('.').pop() || ''
    const uniqueName = `${randomUUID()}.${ext}`
    const filePath = join(UPLOAD_DIR, uniqueName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const attachment = await prisma.attachment.create({
      data: {
        fileName: file.name,
        filePath: uniqueName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        relatedTable,
        relatedId,
        uploadedBy: authResult.session.user.id,
      },
    })

    return successResponse(attachment)
  } catch (error) {
    return handleApiError(error)
  }
}
