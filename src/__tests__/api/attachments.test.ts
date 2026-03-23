/**
 * 난이도: 매우 어려움 (Very Hard)
 * 첨부파일 API (GET/POST/DELETE) 테스트
 * - 파일 업로드 (multipart/form-data → Supabase Storage)
 * - 파일 다운로드 (Supabase Storage)
 * - 파일 삭제 (소유자 검증)
 * - 파일 크기/확장자 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockUploadFile, mockDownloadFile, mockDeleteFile } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    attachment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockUploadFile: vi.fn(),
  mockDownloadFile: vi.fn(),
  mockDeleteFile: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/supabase-storage', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
  deleteFile: (...args: unknown[]) => mockDeleteFile(...args),
  getPublicUrl: (path: string) => `https://project.supabase.co/storage/v1/object/public/uploads/${path}`,
}))

vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { GET as ListAttachments, POST as UploadAttachment } from '@/app/api/v1/attachments/route'
import { GET as DownloadAttachment, DELETE as DeleteAttachment } from '@/app/api/v1/attachments/[id]/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [],
      employeeId: 'emp-1',
      accountType: 'INTERNAL',
      ...overrides,
    },
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

const params = Promise.resolve({ id: 'att-1' })

// ─── GET (목록 조회) ───

describe('GET /api/v1/attachments', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await ListAttachments(createReq('http://localhost/api/v1/attachments?relatedTable=SalesOrder'))
    expect(resp.status).toBe(401)
  })

  it('relatedTable 누락 → 400', async () => {
    setAuthenticated()
    const resp = await ListAttachments(createReq('http://localhost/api/v1/attachments'))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('유효하지 않은 테이블명 → 400', async () => {
    setAuthenticated()
    const resp = await ListAttachments(createReq('http://localhost/api/v1/attachments?relatedTable=InvalidTable'))
    expect(resp.status).toBe(400)
  })

  it('정상 조회: relatedTable만 지정', async () => {
    setAuthenticated()
    mockPrisma.attachment.findMany.mockResolvedValue([{ id: 'att-1', fileName: 'test.pdf' }])
    const resp = await ListAttachments(createReq('http://localhost/api/v1/attachments?relatedTable=SalesOrder'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })

  it('정상 조회: relatedTable + relatedId', async () => {
    setAuthenticated()
    mockPrisma.attachment.findMany.mockResolvedValue([])
    const resp = await ListAttachments(
      createReq('http://localhost/api/v1/attachments?relatedTable=Delivery&relatedId=dlv-1')
    )
    expect(resp.status).toBe(200)
    const callArgs = mockPrisma.attachment.findMany.mock.calls[0][0]
    expect(callArgs.where).toEqual({ relatedTable: 'Delivery', relatedId: 'dlv-1' })
  })
})

// ─── POST (업로드) ───

describe('POST /api/v1/attachments', () => {
  beforeEach(() => vi.resetAllMocks())

  // 확장자별 매직 바이트 (magic byte validation 테스트 통과용)
  const MAGIC_BYTE_MAP: Record<string, Uint8Array> = {
    pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]), // %PDF-1.4
    png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    jpg: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    gif: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
    zip: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  }

  function createUploadReq(
    fileContent: string,
    fileName: string,
    relatedTable: string,
    relatedId: string,
    fileSize?: number
  ): NextRequest {
    const ext = fileName.includes('.') ? (fileName.split('.').pop() || '').toLowerCase() : ''
    const magicBytes = MAGIC_BYTE_MAP[ext]
    // 매직 바이트가 있는 확장자면 올바른 헤더 포함
    const content = magicBytes ? new Blob([magicBytes, new TextEncoder().encode(fileContent)]) : new Blob([fileContent])
    const file = new File([content], fileName, { type: 'application/octet-stream' })
    if (fileSize) {
      Object.defineProperty(file, 'size', { value: fileSize })
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('relatedTable', relatedTable)
    formData.append('relatedId', relatedId)
    return new NextRequest(new URL('http://localhost/api/v1/attachments'), {
      method: 'POST',
      body: formData,
    })
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await UploadAttachment(createUploadReq('test', 'test.pdf', 'SalesOrder', 'so-1'))
    expect(resp.status).toBe(401)
  })

  it('필수 필드 누락 → 400', async () => {
    setAuthenticated()
    const formData = new FormData()
    formData.append('relatedTable', 'SalesOrder')
    const resp = await UploadAttachment(
      new NextRequest(new URL('http://localhost/api/v1/attachments'), { method: 'POST', body: formData })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('유효하지 않은 테이블 → 400', async () => {
    setAuthenticated()
    const resp = await UploadAttachment(createUploadReq('test', 'test.pdf', 'BadTable', 'id-1'))
    expect(resp.status).toBe(400)
  })

  it('파일 크기 초과 (50MB) → 413', async () => {
    setAuthenticated()
    const bigContent = new ArrayBuffer(51 * 1024 * 1024) // 51MB
    const file = new File([bigContent], 'big.pdf', { type: 'application/pdf' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('relatedTable', 'SalesOrder')
    formData.append('relatedId', 'so-1')
    const resp = await UploadAttachment(
      new NextRequest(new URL('http://localhost/api/v1/attachments'), { method: 'POST', body: formData })
    )
    const body = await resp.json()
    expect(resp.status).toBe(413)
    expect(body.error.code).toBe('FILE_TOO_LARGE')
  })

  it('허용되지 않는 확장자 → 400', async () => {
    setAuthenticated()
    const resp = await UploadAttachment(createUploadReq('test', 'malware.exe', 'SalesOrder', 'so-1'))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_FILE_TYPE')
  })

  it('확장자 없는 파일 → 400', async () => {
    setAuthenticated()
    const resp = await UploadAttachment(createUploadReq('test', 'noext', 'SalesOrder', 'so-1'))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_FILE_TYPE')
  })

  it('정상 업로드: PDF', async () => {
    setAuthenticated()
    mockUploadFile.mockResolvedValue(
      'https://project.supabase.co/storage/v1/object/public/uploads/attachments/uuid.pdf'
    )
    mockPrisma.attachment.create.mockResolvedValue({
      id: 'att-new',
      fileName: 'test.pdf',
      filePath: 'attachments/uuid.pdf',
      fileSize: 4,
      mimeType: 'application/pdf',
    })
    const resp = await UploadAttachment(createUploadReq('test', 'test.pdf', 'SalesOrder', 'so-1'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.fileName).toBe('test.pdf')
    expect(mockUploadFile).toHaveBeenCalled()
  })

  it('정상 업로드: 허용된 확장자 (xlsx, png, jpg, csv)', async () => {
    setAuthenticated()
    for (const ext of ['xlsx', 'png', 'jpg', 'csv']) {
      mockUploadFile.mockResolvedValue(
        `https://project.supabase.co/storage/v1/object/public/uploads/attachments/uuid.${ext}`
      )
      mockPrisma.attachment.create.mockResolvedValue({ id: `att-${ext}`, fileName: `file.${ext}` })
      const resp = await UploadAttachment(createUploadReq('content', `file.${ext}`, 'Item', 'item-1'))
      expect(resp.status).toBe(200)
    }
  })

  it('모든 유효 테이블에 업로드 가능', async () => {
    setAuthenticated()
    const tables = ['SalesOrder', 'Quotation', 'Delivery', 'Partner', 'Item', 'Voucher', 'Employee', 'Project']
    for (const table of tables) {
      mockUploadFile.mockResolvedValue(
        'https://project.supabase.co/storage/v1/object/public/uploads/attachments/uuid.pdf'
      )
      mockPrisma.attachment.create.mockResolvedValue({ id: 'att-1', fileName: 'test.pdf' })
      const resp = await UploadAttachment(createUploadReq('data', 'doc.pdf', table, 'id-1'))
      expect(resp.status).toBe(200)
    }
  })
})

// ─── GET /attachments/[id] (다운로드) ───

describe('GET /api/v1/attachments/[id] (다운로드)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 파일 → 404', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue(null)
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 다운로드: Content-Disposition 헤더 포함', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      fileName: 'report.pdf',
      filePath: 'attachments/uuid-123.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    })
    mockDownloadFile.mockResolvedValue(Buffer.from('PDF content'))
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    expect(resp.status).toBe(200)
    expect(resp.headers.get('Content-Type')).toBe('application/pdf')
    expect(resp.headers.get('Content-Disposition')).toContain('attachment')
    expect(resp.headers.get('Content-Disposition')).toContain('report.pdf')
  })

  it('한글 파일명 다운로드: UTF-8 인코딩', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-2',
      fileName: '보고서_2024.xlsx',
      filePath: 'attachments/uuid-456.xlsx',
      fileSize: 2048,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    mockDownloadFile.mockResolvedValue(Buffer.from('Excel content'))
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-2'), { params })
    expect(resp.status).toBe(200)
    const disposition = resp.headers.get('Content-Disposition') || ''
    expect(disposition).toContain("filename*=UTF-8''")
    expect(disposition).toContain(encodeURIComponent('보고서_2024.xlsx'))
  })

  it('스토리지에서 파일을 찾을 수 없는 경우 → 404', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-missing',
      fileName: 'missing.txt',
      filePath: 'attachments/gone.txt',
      fileSize: 100,
      mimeType: 'text/plain',
    })
    mockDownloadFile.mockRejectedValue(new Error('Object not found'))
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-missing'), { params })
    expect(resp.status).toBe(404)
  })
})

// ─── DELETE /attachments/[id] ───

describe('DELETE /api/v1/attachments/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 파일 → 404', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue(null)
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    expect(resp.status).toBe(404)
  })

  it('다른 사용자의 파일 삭제 → 403', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      uploadedBy: 'other-user',
      filePath: 'attachments/uuid.pdf',
    })
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('본인 파일 정상 삭제', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      uploadedBy: 'user-1',
      filePath: 'attachments/uuid-123.pdf',
    })
    mockDeleteFile.mockResolvedValue(undefined)
    mockPrisma.attachment.delete.mockResolvedValue({ id: 'att-1' })
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.deleted).toBe(true)
    expect(mockDeleteFile).toHaveBeenCalled()
    expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } })
  })

  it('스토리지 삭제 실패해도 DB 삭제는 정상 처리', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      uploadedBy: 'user-1',
      filePath: 'attachments/uuid-gone.pdf',
    })
    mockDeleteFile.mockRejectedValue(new Error('Storage error'))
    mockPrisma.attachment.delete.mockResolvedValue({ id: 'att-1' })
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    expect(resp.status).toBe(200)
  })
})
