import { NextRequest } from 'next/server'
import { successResponse, errorResponse, handleApiError, requireAdmin, isErrorResponse } from '@/lib/api-helpers'
import { writeFile, mkdir, readdir, unlink, stat } from 'fs/promises'
import { join, resolve } from 'path'
import { existsSync } from 'fs'

const FONT_DIR = resolve(process.cwd(), 'public', 'fonts')
const MAX_FILE_SIZE = 30 * 1024 * 1024 // 30MB for font files
const ALLOWED_EXTENSIONS = new Set(['ttf', 'otf', 'woff', 'woff2'])

export async function GET() {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    await mkdir(FONT_DIR, { recursive: true })

    const files = await readdir(FONT_DIR)
    const fontFiles = []
    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase() || ''
      if (ALLOWED_EXTENSIONS.has(ext)) {
        const fileStat = await stat(join(FONT_DIR, file))
        fontFiles.push({
          name: file,
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
        })
      }
    }

    return successResponse(fontFiles)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return errorResponse('파일이 필요합니다.', 'VALIDATION_ERROR', 400)
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse('파일 크기가 30MB를 초과합니다.', 'FILE_TOO_LARGE', 413)
    }

    const ext = file.name.includes('.') ? (file.name.split('.').pop() || '').toLowerCase() : ''
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return errorResponse('허용되지 않는 폰트 형식입니다. (허용: ttf, otf, woff, woff2)', 'INVALID_FILE_TYPE', 400)
    }

    // Sanitize filename - only allow alphanumeric, dash, underscore, dot
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')

    await mkdir(FONT_DIR, { recursive: true })
    const filePath = resolve(FONT_DIR, sanitizedName)
    if (!filePath.startsWith(FONT_DIR + '/')) {
      return errorResponse('유효하지 않은 파일명입니다.', 'INVALID_FILENAME', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    return successResponse({ name: sanitizedName, size: file.size })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if (isErrorResponse(authResult)) return authResult

    const sp = req.nextUrl.searchParams
    const filename = sp.get('name')

    if (!filename) {
      return errorResponse('파일명이 필요합니다.', 'VALIDATION_ERROR', 400)
    }

    // Prevent path traversal - resolved path must stay within FONT_DIR
    const filePath = resolve(FONT_DIR, filename)
    if (!filePath.startsWith(FONT_DIR + '/')) {
      return errorResponse('유효하지 않은 파일명입니다.', 'INVALID_FILENAME', 400)
    }
    if (!existsSync(filePath)) {
      return errorResponse('파일을 찾을 수 없습니다.', 'NOT_FOUND', 404)
    }

    await unlink(filePath)
    return successResponse({ message: '폰트가 삭제되었습니다.' })
  } catch (error) {
    return handleApiError(error)
  }
}
