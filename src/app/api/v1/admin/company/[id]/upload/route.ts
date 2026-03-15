import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'
import { randomUUID } from 'crypto'
import { uploadFile, deleteFile } from '@/lib/supabase-storage'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// 파일 매직 바이트로 실제 MIME 타입 검증 (확장자 위조 방지)
const MAGIC_BYTES: [string, number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['jpeg', [0xff, 0xd8, 0xff]],
  ['gif', [0x47, 0x49, 0x46]],
  ['webp', [0x52, 0x49, 0x46, 0x46]],
  ['pdf', [0x25, 0x50, 0x44, 0x46]],
]

function validateMagicBytes(buffer: Buffer, ext: string): boolean {
  const entry = MAGIC_BYTES.find(([e]) => e === ext)
  if (!entry) return true
  const [, bytes] = entry
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[i] !== bytes[i]) return false
  }
  return true
}

const VALID_FIELDS = ['logoPath', 'sealPath', 'bizCertPath', 'bankCopyPath'] as const
type UploadField = (typeof VALID_FIELDS)[number]

const ALLOWED_EXTENSIONS: Record<UploadField, Set<string>> = {
  logoPath: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']),
  sealPath: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']),
  bizCertPath: new Set(['pdf', 'png', 'jpg', 'jpeg']),
  bankCopyPath: new Set(['pdf', 'png', 'jpg', 'jpeg']),
}

const FIELD_LABELS: Record<UploadField, string> = {
  logoPath: '회사 로고',
  sealPath: '법인 인감',
  bizCertPath: '사업자등록증',
  bankCopyPath: '통장사본',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params

    const company = await prisma.company.findUnique({ where: { id }, select: { id: true } })
    if (!company) return errorResponse('회사 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const field = formData.get('field') as string | null

    if (!file || !field) {
      return errorResponse('file과 field는 필수입니다.', 'VALIDATION_ERROR', 400)
    }

    if (!VALID_FIELDS.includes(field as UploadField)) {
      return errorResponse(`유효하지 않은 필드입니다: ${field}`, 'VALIDATION_ERROR', 400)
    }

    const uploadField = field as UploadField

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('파일 크기가 10MB를 초과합니다.', 'FILE_TOO_LARGE', 413)
    }

    const ext = file.name.includes('.') ? (file.name.split('.').pop() || '').toLowerCase() : ''
    if (!ext || !ALLOWED_EXTENSIONS[uploadField].has(ext)) {
      return errorResponse(
        `${FIELD_LABELS[uploadField]}에 허용되지 않는 파일 형식입니다. (허용: ${[...ALLOWED_EXTENSIONS[uploadField]].join(', ')})`,
        'INVALID_FILE_TYPE',
        400
      )
    }

    // Delete old file if exists
    const existing = await prisma.company.findUnique({
      where: { id },
      select: { [uploadField]: true },
    })
    const oldPath = (existing as Record<string, unknown> | null)?.[uploadField] as string | null
    if (oldPath) {
      await deleteFile(oldPath).catch(() => {})
    }

    const uniqueName = `company/${id}-${uploadField}-${randomUUID()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    // 매직 바이트 검증: 확장자 위조 방지
    if (!validateMagicBytes(buffer, ext)) {
      return errorResponse(
        '파일 내용이 확장자와 일치하지 않습니다. 올바른 파일을 업로드해주세요.',
        'INVALID_FILE_CONTENT',
        400
      )
    }

    await uploadFile(uniqueName, buffer, file.type || 'application/octet-stream')

    let updated
    try {
      updated = await prisma.company.update({
        where: { id },
        data: { [uploadField]: uniqueName },
      })
    } catch (dbError) {
      // DB 업데이트 실패 시 고아 파일 정리
      await deleteFile(uniqueName).catch(() => {})
      throw dbError
    }

    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const { id } = await params
    const sp = req.nextUrl.searchParams
    const field = sp.get('field')

    if (!field || !VALID_FIELDS.includes(field as UploadField)) {
      return errorResponse('유효하지 않은 필드입니다.', 'VALIDATION_ERROR', 400)
    }

    const uploadField = field as UploadField

    const company = await prisma.company.findUnique({
      where: { id },
      select: { [uploadField]: true },
    })
    if (!company) return errorResponse('회사 정보를 찾을 수 없습니다.', 'NOT_FOUND', 404)

    const storagePath = company[uploadField] as string | null
    if (storagePath) {
      await deleteFile(storagePath).catch(() => {})
    }

    const updated = await prisma.company.update({
      where: { id },
      data: { [uploadField]: null },
    })

    return successResponse(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
