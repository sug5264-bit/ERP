/**
 * 난이도: 매우 어려움 (Very Hard)
 * 관리자 사용자 관리 API 라우트 핸들러 통합 테스트
 * GET: 관리자 전용, 검색, 페이지네이션, 역할/사원 포함
 * POST: 관리자 전용, 유효성검증, 중복 아이디/이메일, 비밀번호 해싱, 역할 할당
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockHash } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  mockHash: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('bcryptjs', () => ({
  hash: (...args: unknown[]) => mockHash(...args),
}))

vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, POST } from '@/app/api/v1/admin/users/route'

function setAdmin(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      roles: ['관리자'],
      permissions: [{ module: 'admin', action: 'manage' }],
      employeeId: 'emp-admin',
      accountType: 'INTERNAL',
      ...overrides,
    },
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

// ─── GET Tests ───

describe('GET /api/v1/admin/users', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/admin/users'))
    expect(resp.status).toBe(401)
  })

  it('관리자가 아닌 사용자 → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-2', roles: ['일반사용자'], permissions: [] },
    })
    const resp = await GET(createReq('http://localhost/api/v1/admin/users'))
    expect(resp.status).toBe(403)
  })

  it('정상 조회: 사용자 목록 + 역할/사원 정보', async () => {
    setAdmin()
    const users = [
      {
        id: 'u1',
        username: 'admin',
        email: 'admin@test.com',
        name: '관리자',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date('2024-01-01'),
        userRoles: [{ role: { id: 'r1', name: '관리자', description: '시스템 관리자' } }],
        employee: {
          id: 'e1',
          employeeNo: 'EMP-001',
          nameKo: '홍길동',
          department: { name: '개발팀' },
          position: { name: '팀장' },
        },
      },
    ]
    mockPrisma.user.findMany.mockResolvedValue(users)
    mockPrisma.user.count.mockResolvedValue(1)

    const resp = await GET(createReq('http://localhost/api/v1/admin/users'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].roles).toHaveLength(1)
    expect(body.data[0].employee.department).toBe('개발팀')
  })

  it('검색 필터: 이름, 이메일', async () => {
    setAdmin()
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/admin/users?search=홍길동'))

    const callArgs = mockPrisma.user.findMany.mock.calls[0][0]
    expect(callArgs.where.OR).toHaveLength(2)
  })

  it('사원 미연결 사용자도 정상 반환', async () => {
    setAdmin()
    const users = [
      {
        id: 'u2',
        username: 'external',
        email: 'ext@test.com',
        name: '외부 사용자',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date('2024-01-01'),
        userRoles: [],
        employee: null,
      },
    ]
    mockPrisma.user.findMany.mockResolvedValue(users)
    mockPrisma.user.count.mockResolvedValue(1)

    const resp = await GET(createReq('http://localhost/api/v1/admin/users'))
    const body = await resp.json()

    expect(body.data[0].employee).toBeNull()
  })

  it('DB 에러 → 500', async () => {
    setAdmin()
    mockPrisma.user.findMany.mockRejectedValue(new Error('Connection refused'))
    mockPrisma.user.count.mockRejectedValue(new Error('Connection refused'))

    const resp = await GET(createReq('http://localhost/api/v1/admin/users'))
    expect(resp.status).toBe(500)
  })
})

// ─── POST Tests ───

describe('POST /api/v1/admin/users', () => {
  beforeEach(() => vi.resetAllMocks())

  const validBody = {
    username: 'newuser',
    email: 'new@example.com',
    password: 'SecureP@ss123',
    name: '신규 사용자',
    roleIds: ['role-1'],
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    expect(resp.status).toBe(401)
  })

  it('중복 아이디 → 409', async () => {
    setAdmin()
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'existing' }) // username 중복
      .mockResolvedValueOnce(null)

    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(409)
    expect(body.error.code).toBe('DUPLICATE_USERNAME')
  })

  it('중복 이메일 → 409', async () => {
    setAdmin()
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // username OK
      .mockResolvedValueOnce({ id: 'existing' }) // email 중복

    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(409)
    expect(body.error.code).toBe('DUPLICATE_EMAIL')
  })

  it('정상 사용자 생성', async () => {
    setAdmin()
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // username 중복 체크
      .mockResolvedValueOnce(null) // email 중복 체크
    mockHash.mockResolvedValue('hashed-password')
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-new',
      email: 'new@example.com',
      name: '신규 사용자',
      userRoles: [{ role: { name: '일반사용자' } }],
    })

    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.email).toBe('new@example.com')
    expect(mockHash).toHaveBeenCalledWith('SecureP@ss123', 12)
  })

  it('유효성 검증 실패: 짧은 비밀번호 → 400', async () => {
    setAdmin()
    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, password: 'short' }),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('유효성 검증 실패: roleIds 빈 배열 → 400', async () => {
    setAdmin()
    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, roleIds: [] }),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('잘못된 JSON → 400 INVALID_JSON', async () => {
    setAdmin()
    const resp = await POST(
      createReq('http://localhost/api/v1/admin/users', {
        method: 'POST',
        body: '{{invalid',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_JSON')
  })
})
