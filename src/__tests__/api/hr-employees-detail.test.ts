/**
 * 난이도: 매우 어려움 (Very Hard)
 * HR 사원 상세 API (GET/PUT/DELETE) 통합 테스트
 * GET: 민감정보 필터링, 404 처리
 * PUT: 존재 확인 후 수정 (없는 경우 404 반환), 날짜 변환
 * DELETE: 소프트 삭제(RESIGNED), 연결 사용자 비활성화
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockHasPermission, mockWriteAuditLog } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    employee: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  mockHasPermission: vi.fn().mockReturnValue(true),
  mockWriteAuditLog: vi.fn().mockReturnValue(Promise.resolve()),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/rbac', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}))
vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, PUT, DELETE } from '@/app/api/v1/hr/employees/[id]/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
        { module: 'hr', action: 'read' },
        { module: 'hr', action: 'update' },
        { module: 'hr', action: 'delete' },
        { module: 'hr.employees', action: 'read' },
      ],
      employeeId: 'emp-1',
      accountType: 'INTERNAL',
      ...overrides,
    },
  })
  // vi.resetAllMocks() 후 hasPermission이 undefined 반환하므로 명시적으로 설정
  mockHasPermission.mockReturnValue(true)
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

const params = Promise.resolve({ id: 'emp-target' })

// ─── GET ───

describe('GET /api/v1/hr/employees/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWriteAuditLog.mockReturnValue(Promise.resolve())
  })

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/hr/employees/emp-target'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 사원 → 404', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/hr/employees/emp-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 조회 (민감정보 포함)', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-target',
      nameKo: '홍길동',
      phone: '010-1234-5678',
      birthDate: new Date('1990-01-01'),
      department: { name: '영업팀' },
      position: null,
      user: null,
      leaveBalances: [],
      employeeHistories: [],
    })
    const resp = await GET(createReq('http://localhost/api/v1/hr/employees/emp-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.phone).toBe('010-1234-5678')
  })
})

// ─── PUT ───

describe('PUT /api/v1/hr/employees/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWriteAuditLog.mockReturnValue(Promise.resolve())
  })

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await PUT(
      createReq('http://localhost/api/v1/hr/employees/emp-target', {
        method: 'PUT',
        body: JSON.stringify({ nameKo: '홍길동' }),
      }),
      { params }
    )
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 사원 수정 → 404 NOT_FOUND (DATABASE_ERROR 아님)', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue(null)
    const resp = await PUT(
      createReq('http://localhost/api/v1/hr/employees/emp-target', {
        method: 'PUT',
        body: JSON.stringify({ nameKo: '홍길동' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
    // 이전 버그: Prisma P2025가 DATABASE_ERROR(400)로 반환되었음
    // 수정 후: 명시적 404 NOT_FOUND 반환
    expect(body.error.code).not.toBe('DATABASE_ERROR')
  })

  it('정상 수정', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-target', nameKo: '기존이름' })
    mockPrisma.employee.update.mockResolvedValue({
      id: 'emp-target',
      nameKo: '홍길동',
      department: { name: '영업팀' },
      position: null,
    })
    const resp = await PUT(
      createReq('http://localhost/api/v1/hr/employees/emp-target', {
        method: 'PUT',
        body: JSON.stringify({ nameKo: '홍길동' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.nameKo).toBe('홍길동')
  })

  it('입사일 없는 경우 → 400 VALIDATION_ERROR', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-target' })
    const resp = await PUT(
      createReq('http://localhost/api/v1/hr/employees/emp-target', {
        method: 'PUT',
        body: JSON.stringify({ joinDate: null }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── DELETE ───

describe('DELETE /api/v1/hr/employees/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWriteAuditLog.mockReturnValue(Promise.resolve())
  })

  it('존재하지 않는 사원 삭제 → 404', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/hr/employees/emp-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 소프트 삭제 (사용자 계정 없는 사원)', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-target', user: null })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        employee: { update: vi.fn().mockResolvedValue({ id: 'emp-target', status: 'RESIGNED' }) },
        user: { update: vi.fn() },
      }
      return fn(tx)
    })
    const resp = await DELETE(createReq('http://localhost/api/v1/hr/employees/emp-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.message).toBe('사원이 비활성화되었습니다.')
  })

  it('정상 소프트 삭제 (연결 사용자 계정 비활성화)', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 'emp-target',
      user: { id: 'user-linked' },
    })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockUserUpdate = vi.fn().mockResolvedValue({ id: 'user-linked', isActive: false })
      const mockEmpUpdate = vi.fn().mockResolvedValue({ id: 'emp-target', status: 'RESIGNED' })
      const tx = {
        employee: { update: mockEmpUpdate },
        user: { update: mockUserUpdate },
      }
      await fn(tx)
      // 연결된 사용자 비활성화가 호출되어야 함
      expect(mockUserUpdate).toHaveBeenCalledWith({
        where: { id: 'user-linked' },
        data: { isActive: false },
      })
    })
    const resp = await DELETE(createReq('http://localhost/api/v1/hr/employees/emp-target'), { params })
    expect(resp.status).toBe(200)
  })
})
