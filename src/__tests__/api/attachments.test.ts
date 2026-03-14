/**
 * 난이도: 매우 어려움 (Very Hard)
 * 첨부파일 API (GET/POST/DELETE) 테스트
 * - 파일 업로드 (multipart/form-data)
 * - 파일 다운로드 (바이너리 스트림)
 * - 파일 삭제 (소유자 검증)
 * - 파일 크기/확장자 검증
 * - 경로 순회 방지 (path traversal)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockWriteFile, mockMkdir, mockReadFile, mockUnlink, mockAccess } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    attachment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockReadFile: vi.fn(),
  mockUnlink: vi.fn().mockResolvedValue(undefined),
  mockAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  access: (...args: unknown[]) => mockAccess(...args),
  constants: { W_OK: 2 },
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

  function createUploadReq(
    fileContent: string,
    fileName: string,
    relatedTable: string,
    relatedId: string,
    fileSize?: number
  ): NextRequest {
    const file = new File([fileContent], fileName, { type: 'application/pdf' })
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
    // File 객체의 size를 직접 mock할 수 없으므로, 큰 ArrayBuffer를 생성
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
    mockPrisma.attachment.create.mockResolvedValue({
      id: 'att-new',
      fileName: 'test.pdf',
      filePath: 'uuid.pdf',
      fileSize: 4,
      mimeType: 'application/pdf',
    })
    const resp = await UploadAttachment(createUploadReq('test', 'test.pdf', 'SalesOrder', 'so-1'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.fileName).toBe('test.pdf')
    expect(mockWriteFile).toHaveBeenCalled()
    expect(mockMkdir).toHaveBeenCalled()
  })

  it('정상 업로드: 허용된 확장자 (xlsx, png, jpg, csv)', async () => {
    setAuthenticated()
    for (const ext of ['xlsx', 'png', 'jpg', 'csv']) {
      mockPrisma.attachment.create.mockResolvedValue({ id: `att-${ext}`, fileName: `file.${ext}` })
      const resp = await UploadAttachment(createUploadReq('content', `file.${ext}`, 'Item', 'item-1'))
      expect(resp.status).toBe(200)
    }
  })

  it('모든 유효 테이블에 업로드 가능', async () => {
    setAuthenticated()
    const tables = ['SalesOrder', 'Quotation', 'Delivery', 'Partner', 'Item', 'Voucher', 'Employee', 'Project']
    for (const table of tables) {
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
      filePath: 'uuid-123.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    })
    mockReadFile.mockResolvedValue(Buffer.from('PDF content'))
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
      filePath: 'uuid-456.xlsx',
      fileSize: 2048,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    mockReadFile.mockResolvedValue(Buffer.from('Excel content'))
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-2'), { params })
    expect(resp.status).toBe(200)
    const disposition = resp.headers.get('Content-Disposition') || ''
    expect(disposition).toContain("filename*=UTF-8''")
    expect(disposition).toContain(encodeURIComponent('보고서_2024.xlsx'))
  })

  it('경로 순회 방지: ../가 포함된 filePath', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-evil',
      fileName: 'evil.txt',
      filePath: '../../etc/passwd',
      fileSize: 100,
      mimeType: 'text/plain',
    })
    const resp = await DownloadAttachment(createReq('http://localhost/api/v1/attachments/att-evil'), { params })
    // safePath 함수가 에러를 throw → handleApiError가 500으로 처리
    expect(resp.status).toBe(500)
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
      filePath: 'uuid.pdf',
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
      filePath: 'uuid-123.pdf',
    })
    mockPrisma.attachment.delete.mockResolvedValue({ id: 'att-1' })
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.deleted).toBe(true)
    expect(mockUnlink).toHaveBeenCalled()
    expect(mockPrisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } })
  })

  it('파일이 이미 삭제된 경우 (ENOENT) → 정상 처리', async () => {
    setAuthenticated()
    mockPrisma.attachment.findUnique.mockResolvedValue({
      id: 'att-1',
      uploadedBy: 'user-1',
      filePath: 'uuid-gone.pdf',
    })
    mockUnlink.mockRejectedValue(new Error('ENOENT: no such file'))
    mockPrisma.attachment.delete.mockResolvedValue({ id: 'att-1' })
    const resp = await DeleteAttachment(createReq('http://localhost/api/v1/attachments/att-1'), { params })
    expect(resp.status).toBe(200)
  })
})
