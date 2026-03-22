/**
 * 난이도: 매우 어려움 (Very Hard)
 * 관리자 사용자 상세 API (GET/PUT/DELETE) 통합 테스트
 * PUT: 자기 자신 비활성화 방지, username/email 중복 체크, 역할 변경
 * DELETE: 자기 자신 삭제 방지, 마지막 관리자 비활성화 방지
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockHash } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    employee: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  mockHash: vi.fn().mockResolvedValue('hashed-password'),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('bcryptjs', () => ({ hash: (...args: unknown[]) => mockHash(...args) }))
vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, PUT, DELETE } from '@/app/api/v1/admin/users/[id]/route'

function setAdmin(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'admin-1',
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

const params = Promise.resolve({ id: 'user-target' })
const selfParams = Promise.resolve({ id: 'admin-1' })

// ─── GET ───

describe('GET /api/v1/admin/users/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/admin/users/user-target'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 사용자 → 404', async () => {
    setAdmin()
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/admin/users/user-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 조회', async () => {
    setAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-target',
      username: 'testuser',
      email: 'test@example.com',
      name: '홍길동',
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      userRoles: [{ role: { id: 'role-1', name: '일반사원' } }],
      employee: null,
    })
    const resp = await GET(createReq('http://localhost/api/v1/admin/users/user-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.username).toBe('testuser')
    expect(body.data.roles).toHaveLength(1)
  })
})

// ─── PUT ───

describe('PUT /api/v1/admin/users/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await PUT(
      createReq('http://localhost/api/v1/admin/users/user-target', {
        method: 'PUT',
        body: JSON.stringify({ name: '변경' }),
      }),
      { params }
    )
    expect(resp.status).toBe(401)
  })

  it('자기 자신을 비활성화 → 400 SELF_DEACTIVATE', async () => {
    setAdmin()
    const resp = await PUT(
      createReq('http://localhost/api/v1/admin/users/admin-1', {
        method: 'PUT',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: selfParams }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('SELF_DEACTIVATE')
  })

  it('자기 자신을 활성화는 허용', async () => {
    setAdmin()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', name: 'Admin' }),
        },
        userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
        employee: { update: vi.fn() },
      }
      return fn(tx)
    })
    const resp = await PUT(
      createReq('http://localhost/api/v1/admin/users/admin-1', {
        method: 'PUT',
        body: JSON.stringify({ isActive: true }),
      }),
      { params: selfParams }
    )
    expect(resp.status).toBe(200)
  })

  it('username 중복 → 409 CONFLICT', async () => {
    setAdmin()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        user: { findFirst: vi.fn().mockResolvedValue({ id: 'other-user' }), update: vi.fn() },
        userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
        employee: { update: vi.fn() },
      }
      return fn(tx)
    })
    const resp = await PUT(
      createReq('http://localhost/api/v1/admin/users/user-target', {
        method: 'PUT',
        body: JSON.stringify({ username: 'existinguser' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
  })

  it('정상 수정', async () => {
    setAdmin()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        user: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi
            .fn()
            .mockResolvedValue({ id: 'user-target', email: 'new@example.com', name: '새이름', employeeId: null }),
        },
        userRole: { deleteMany: vi.fn(), createMany: vi.fn() },
        employee: { update: vi.fn() },
      }
      return fn(tx)
    })
    const resp = await PUT(
      createReq('http://localhost/api/v1/admin/users/user-target', {
        method: 'PUT',
        body: JSON.stringify({ name: '새이름' }),
      }),
      { params }
    )
    expect(resp.status).toBe(200)
  })
})

// ─── DELETE ───

describe('DELETE /api/v1/admin/users/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('자기 자신 삭제 → 400 SELF_DELETE', async () => {
    setAdmin()
    const resp = await DELETE(createReq('http://localhost/api/v1/admin/users/admin-1'), {
      params: selfParams,
    })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('SELF_DELETE')
  })

  it('존재하지 않는 사용자 삭제 → 404', async () => {
    setAdmin()
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/admin/users/user-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('마지막 관리자 비활성화 불가 → 400 LAST_ADMIN', async () => {
    setAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-target',
      userRoles: [{ role: { name: 'SYSTEM_ADMIN' } }],
    })
    mockPrisma.user.count.mockResolvedValue(1) // 관리자 1명만 존재
    const resp = await DELETE(createReq('http://localhost/api/v1/admin/users/user-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('LAST_ADMIN')
  })

  it('정상 비활성화', async () => {
    setAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-target',
      userRoles: [{ role: { name: '일반사원' } }],
    })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-target', isActive: false })
    const resp = await DELETE(createReq('http://localhost/api/v1/admin/users/user-target'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.message).toBe('사용자가 비활성화되었습니다.')
  })
})
