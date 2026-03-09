import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'company')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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

    await mkdir(UPLOAD_DIR, { recursive: true })

    // Delete old file if exists
    const existing = await prisma.company.findUnique({
      where: { id },
      select: { [uploadField]: true },
    })
    const oldPath = (existing as Record<string, unknown> | null)?.[uploadField] as string | null
    if (oldPath) {
      const oldFilePath = join(UPLOAD_DIR, oldPath)
      if (existsSync(oldFilePath)) {
        await unlink(oldFilePath).catch(() => {})
      }
    }

    const uniqueName = `${id}-${uploadField}-${randomUUID()}.${ext}`
    const filePath = join(UPLOAD_DIR, uniqueName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const updated = await prisma.company.update({
      where: { id },
      data: { [uploadField]: uniqueName },
    })

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

    const filePath = company[uploadField] as string | null
    if (filePath) {
      const fullPath = join(UPLOAD_DIR, filePath)
      if (existsSync(fullPath)) {
        await unlink(fullPath).catch(() => {})
      }
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
