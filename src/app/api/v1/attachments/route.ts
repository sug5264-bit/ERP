import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAuth, isErrorResponse } from '@/lib/api-helpers'
import { uploadFile, deleteFile, SHIPPER_BUCKET } from '@/lib/supabase-storage'
import { randomUUID } from 'crypto'
import { sanitizeFileName } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Next.js App Router: route segment config for large file uploads
export const maxDuration = 60 // seconds

// 파일 매직 바이트로 실제 MIME 타입 검증 (확장자 위조 방지)
const MAGIC_BYTES: [string[], number[]][] = [
  [['png'], [0x89, 0x50, 0x4e, 0x47]],
  [
    ['jpg', 'jpeg'],
    [0xff, 0xd8, 0xff],
  ],
  [['gif'], [0x47, 0x49, 0x46]],
  [['pdf'], [0x25, 0x50, 0x44, 0x46]],
  [['zip'], [0x50, 0x4b, 0x03, 0x04]],
  [['rar'], [0x52, 0x61, 0x72, 0x21]],
  [['7z'], [0x37, 0x7a, 0xbc, 0xaf]],
]

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const entry = MAGIC_BYTES.find(([exts]) => exts.includes(ext))
  if (!entry) return true // 매직 바이트가 정의되지 않은 확장자는 통과
  const [, bytes] = entry
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[i] !== bytes[i]) return false
  }
  return true
}

const VALID_TABLES = [
  'SalesOrder',
  'SalesOrderPost',
  'Quotation',
  'Delivery',
  'DeliveryPost',
  'DeliveryReply',
  'DeliveryReplyPost',
  'SalesReturn',
  'Partner',
  'Item',
  'PurchaseOrder',
  'Voucher',
  'Employee',
  'Project',
  'Recruitment',
  'ShipperOrderAttachment',
  'ShipperDeliveryReplyPost',
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
      return errorResponse('relatedTable이 필요합니다.', 'VALIDATION_ERROR', 400)
    }
    if (!VALID_TABLES.includes(relatedTable)) {
      return errorResponse('유효하지 않은 테이블입니다.', 'VALIDATION_ERROR', 400)
    }

    const where: Record<string, unknown> = { relatedTable }
    if (relatedId) where.relatedId = relatedId

    const attachments = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // 과도한 데이터 반환 방지
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
      logger.error('필수 파라미터 누락', { hasFile: !!file, relatedTable, relatedId })
      return errorResponse('file, relatedTable, relatedId가 필요합니다.', 'VALIDATION_ERROR', 400)
    }

    if (!VALID_TABLES.includes(relatedTable)) {
      return errorResponse('유효하지 않은 테이블입니다.', 'VALIDATION_ERROR', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('파일 크기가 50MB를 초과합니다.', 'FILE_TOO_LARGE', 413)
    }

    const ext = file.name.includes('.') ? (file.name.split('.').pop() || '').toLowerCase() : ''
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return errorResponse('허용되지 않는 파일 형식입니다.', 'INVALID_FILE_TYPE', 400)
    }

    const isShipper = relatedTable === 'ShipperOrderAttachment'
    const bucket = isShipper ? SHIPPER_BUCKET : undefined
    const uniqueName = `attachments/${randomUUID()}.${ext}`

    let buffer: Buffer
    try {
      buffer = Buffer.from(await file.arrayBuffer())
    } catch (readErr) {
      logger.error('Failed to read uploaded file buffer', { fileName: file.name, error: readErr })
      return errorResponse('파일 데이터를 읽을 수 없습니다.', 'FILE_READ_ERROR', 400)
    }

    // 매직 바이트 검증: 확장자 위조 방지
    if (!validateMagicBytes(buffer, ext)) {
      return errorResponse(
        '파일 내용이 확장자와 일치하지 않습니다. 올바른 파일을 업로드해주세요.',
        'INVALID_FILE_CONTENT',
        400
      )
    }

    try {
      await uploadFile(uniqueName, buffer, file.type || 'application/octet-stream', bucket)
    } catch (uploadErr) {
      logger.error('Supabase Storage 업로드 실패', {
        uniqueName,
        error: uploadErr instanceof Error ? uploadErr.message : uploadErr,
      })
      return errorResponse('파일을 저장할 수 없습니다. 스토리지 설정을 확인해주세요.', 'STORAGE_ERROR', 500)
    }

    let attachment
    try {
      attachment = await prisma.attachment.create({
        data: {
          fileName: sanitizeFileName(file.name),
          filePath: uniqueName,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          relatedTable,
          relatedId,
          uploadedBy: authResult.session.user.id,
        },
      })
    } catch (dbErr) {
      // DB 저장 실패 시 스토리지에서 고아 파일 정리
      await deleteFile(uniqueName).catch(() => {})
      throw dbErr
    }

    logger.info('첨부파일 업로드 완료', { attachmentId: attachment.id, fileName: attachment.fileName })
    return successResponse(attachment)
  } catch (error) {
    logger.error('첨부파일 업로드 에러', { error: error instanceof Error ? error.message : error })
    return handleApiError(error)
  }
}
