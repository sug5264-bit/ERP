/**
 * 난이도: 어려움 (Hard)
 * 회사 파일 업로드/다운로드 API 테스트
 * - 로고, 법인인감, 사업자등록증, 통장사본 업로드
 * - 매직 바이트 검증 (확장자 위조 방지)
 * - 필드별 허용 확장자 제한
 * - 파일 서빙 (Supabase Storage)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockUploadFile, mockDownloadFile, mockDeleteFile } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    company: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockUploadFile: vi.fn().mockResolvedValue('https://project.supabase.co/storage/v1/object/public/uploads/company/file.png'),
  mockDownloadFile: vi.fn(),
  mockDeleteFile: vi.fn().mockResolvedValue(undefined),
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

import { POST as UploadCompanyFile, DELETE as DeleteCompanyFile } from '@/app/api/v1/admin/company/[id]/upload/route'
import { GET as ServeCompanyFile } from '@/app/api/v1/admin/company/file/[filename]/route'

function setAdmin() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'admin-1',
      roles: ['관리자'],
      permissions: [],
      employeeId: 'emp-1',
      accountType: 'INTERNAL',
    },
  })
}

function setNonAdmin() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['일반사원'],
      permissions: [],
      employeeId: 'emp-2',
      accountType: 'INTERNAL',
    },
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

const companyParams = Promise.resolve({ id: 'company-1' })

// ─── POST (회사 파일 업로드) ───

describe('POST /api/v1/admin/company/[id]/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockDeleteFile.mockResolvedValue(undefined)
    mockUploadFile.mockResolvedValue('https://project.supabase.co/storage/v1/object/public/uploads/company/file.png')
  })

  function createUploadReq(fileName: string, field: string, content?: number[]): NextRequest {
    const buffer = content ? new Uint8Array(content) : new Uint8Array([0x25, 0x50, 0x44, 0x46]) // PDF magic bytes
    const file = new File([buffer], fileName)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('field', field)
    return new NextRequest(new URL('http://localhost/api/v1/admin/company/company-1/upload'), {
      method: 'POST',
      body: formData,
    })
  }

  it('관리자가 아닌 사용자 → 403', async () => {
    setNonAdmin()
    const resp = await UploadCompanyFile(createUploadReq('logo.png', 'logoPath'), { params: companyParams })
    expect(resp.status).toBe(403)
  })

  it('존재하지 않는 회사 → 404', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue(null)
    const resp = await UploadCompanyFile(createUploadReq('logo.png', 'logoPath'), { params: companyParams })
    expect(resp.status).toBe(404)
  })

  it('필수 필드 누락 → 400', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1' })
    const formData = new FormData()
    formData.append('field', 'logoPath')
    // file 누락
    const resp = await UploadCompanyFile(
      new NextRequest(new URL('http://localhost/api/v1/admin/company/company-1/upload'), {
        method: 'POST',
        body: formData,
      }),
      { params: companyParams }
    )
    expect(resp.status).toBe(400)
  })

  it('유효하지 않은 필드 → 400', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1' })
    const resp = await UploadCompanyFile(createUploadReq('hack.pdf', 'invalidField'), { params: companyParams })
    expect(resp.status).toBe(400)
  })

  it('파일 크기 초과 (10MB) → 413', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1' })
    const bigContent = new ArrayBuffer(11 * 1024 * 1024) // 11MB
    const file = new File([bigContent], 'large.png', { type: 'image/png' })
    const formData = new FormData()
    formData.append('file', file)
    formData.append('field', 'logoPath')
    const resp = await UploadCompanyFile(
      new NextRequest(new URL('http://localhost/api/v1/admin/company/company-1/upload'), {
        method: 'POST',
        body: formData,
      }),
      { params: companyParams }
    )
    const body = await resp.json()
    expect(resp.status).toBe(413)
    expect(body.error.code).toBe('FILE_TOO_LARGE')
  })

  it('로고에 PDF 불가 → 400', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'company-1' })
    const resp = await UploadCompanyFile(createUploadReq('logo.pdf', 'logoPath'), { params: companyParams })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_FILE_TYPE')
  })

  it('사업자등록증에 PDF 허용', async () => {
    setAdmin()
    mockPrisma.company.findUnique
      .mockResolvedValueOnce({ id: 'company-1' })
      .mockResolvedValueOnce({ bizCertPath: null })
    mockPrisma.company.update.mockResolvedValue({ id: 'company-1', bizCertPath: 'new.pdf' })
    const resp = await UploadCompanyFile(createUploadReq('cert.pdf', 'bizCertPath'), { params: companyParams })
    expect(resp.status).toBe(200)
  })

  it('매직 바이트 불일치 (확장자 위조) → 400', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValueOnce({ id: 'company-1' }).mockResolvedValueOnce({ logoPath: null })
    // PNG 확장자지만 PDF 매직 바이트
    const resp = await UploadCompanyFile(createUploadReq('fake.png', 'logoPath', [0x25, 0x50, 0x44, 0x46]), {
      params: companyParams,
    })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_FILE_CONTENT')
  })

  it('정상 업로드: PNG 로고 (올바른 매직 바이트)', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValueOnce({ id: 'company-1' }).mockResolvedValueOnce({ logoPath: null })
    mockPrisma.company.update.mockResolvedValue({ id: 'company-1', logoPath: 'new-logo.png' })
    const resp = await UploadCompanyFile(
      createUploadReq('logo.png', 'logoPath', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      { params: companyParams }
    )
    expect(resp.status).toBe(200)
    expect(mockUploadFile).toHaveBeenCalled()
  })

  it('기존 파일 교체 시 이전 파일 삭제', async () => {
    setAdmin()
    mockPrisma.company.findUnique
      .mockResolvedValueOnce({ id: 'company-1' })
      .mockResolvedValueOnce({ sealPath: 'company/old-seal.png' })
    mockPrisma.company.update.mockResolvedValue({ id: 'company-1', sealPath: 'new-seal.png' })
    const resp = await UploadCompanyFile(createUploadReq('seal.png', 'sealPath', [0x89, 0x50, 0x4e, 0x47]), {
      params: companyParams,
    })
    expect(resp.status).toBe(200)
    expect(mockDeleteFile).toHaveBeenCalledWith('company/old-seal.png')
  })
})

// ─── DELETE (회사 파일 삭제) ───

describe('DELETE /api/v1/admin/company/[id]/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockDeleteFile.mockResolvedValue(undefined)
  })

  it('유효하지 않은 필드 → 400', async () => {
    setAdmin()
    const resp = await DeleteCompanyFile(
      new NextRequest(new URL('http://localhost/api/v1/admin/company/company-1/upload?field=badField')),
      { params: companyParams }
    )
    expect(resp.status).toBe(400)
  })

  it('존재하지 않는 회사 → 404', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue(null)
    const resp = await DeleteCompanyFile(
      new NextRequest(new URL('http://localhost/api/v1/admin/company/company-1/upload?field=logoPath')),
      { params: companyParams }
    )
    expect(resp.status).toBe(404)
  })

  it('정상 삭제: Supabase Storage에서 파일 삭제', async () => {
    setAdmin()
    mockPrisma.company.findUnique.mockResolvedValue({ logoPath: 'company/old-logo.png' })
    mockPrisma.company.update.mockResolvedValue({ id: 'company-1', logoPath: null })
    const resp = await DeleteCompanyFile(
      new NextRequest(new URL('http://localhost/api/v1/admin/company/company-1/upload?field=logoPath')),
      { params: companyParams }
    )
    expect(resp.status).toBe(200)
    expect(mockDeleteFile).toHaveBeenCalledWith('company/old-logo.png')
  })
})

// ─── GET /admin/company/file/[filename] (파일 서빙) ───

describe('GET /api/v1/admin/company/file/[filename]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await ServeCompanyFile(createReq('http://localhost/api/v1/admin/company/file/logo.png'), {
      params: Promise.resolve({ filename: 'logo.png' }),
    })
    expect(resp.status).toBe(401)
  })

  it('경로 순회 방지: ../가 포함된 파일명 → 400', async () => {
    setAdmin()
    const resp = await ServeCompanyFile(createReq('http://localhost/api/v1/admin/company/file/../../../etc/passwd'), {
      params: Promise.resolve({ filename: '../../../etc/passwd' }),
    })
    expect(resp.status).toBe(400)
  })

  it('존재하지 않는 파일 → 404', async () => {
    setAdmin()
    mockDownloadFile.mockRejectedValue(new Error('Object not found'))
    const resp = await ServeCompanyFile(createReq('http://localhost/api/v1/admin/company/file/missing.png'), {
      params: Promise.resolve({ filename: 'missing.png' }),
    })
    expect(resp.status).toBe(404)
  })

  it('정상 서빙: PNG 파일', async () => {
    setAdmin()
    mockDownloadFile.mockResolvedValue(Buffer.from('PNG content'))
    const resp = await ServeCompanyFile(createReq('http://localhost/api/v1/admin/company/file/logo.png'), {
      params: Promise.resolve({ filename: 'logo.png' }),
    })
    expect(resp.status).toBe(200)
    expect(resp.headers.get('Content-Type')).toBe('image/png')
    expect(resp.headers.get('Cache-Control')).toContain('max-age=3600')
  })

  it('알 수 없는 확장자 → application/octet-stream', async () => {
    setAdmin()
    mockDownloadFile.mockResolvedValue(Buffer.from('binary data'))
    const resp = await ServeCompanyFile(createReq('http://localhost/api/v1/admin/company/file/data.bin'), {
      params: Promise.resolve({ filename: 'data.bin' }),
    })
    expect(resp.status).toBe(200)
    expect(resp.headers.get('Content-Type')).toBe('application/octet-stream')
  })
})
