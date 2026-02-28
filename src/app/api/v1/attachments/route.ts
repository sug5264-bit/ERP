import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'attachments')
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const VALID_TABLES = [
  'salesOrder',
  'quotation',
  'delivery',
  'salesReturn',
  'partner',
  'item',
  'purchaseOrder',
  'voucher',
  'employee',
  'project',
  'recruitment',
]

/** 허용된 확장자만 업로드 가능 */
const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'xlsx',
  'xls',
  'csv',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'bmp',
  'webp',
  'zip',
  'rar',
  '7z',
])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (isErrorResponse(authResult)) return authResult

    const sp = request.nextUrl.searchParams
    const relatedTable = sp.get('relatedTable')
    const relatedId = sp.get('relatedId')

    if (!relatedTable) {
      return errorResponse('relatedTable이 필요합니다.', 'VALIDATION_ERROR')
    }
    if (!VALID_TABLES.includes(relatedTable)) {
      return errorResponse('유효하지 않은 테이블입니다.', 'VALIDATION_ERROR', 400)
    }

    const where: any = { relatedTable }
    if (relatedId) where.relatedId = relatedId

    const attachments = await prisma.attachment.findMany({
      where,
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

    if (!VALID_TABLES.includes(relatedTable)) {
      return errorResponse('유효하지 않은 테이블입니다.', 'VALIDATION_ERROR', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('파일 크기가 50MB를 초과합니다.', 'FILE_TOO_LARGE')
    }

    const ext = file.name.includes('.') ? (file.name.split('.').pop() || '').toLowerCase() : ''
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return errorResponse('허용되지 않는 파일 형식입니다.', 'INVALID_FILE_TYPE', 400)
    }

    await mkdir(UPLOAD_DIR, { recursive: true })
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
