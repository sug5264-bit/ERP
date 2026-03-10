/**
 * 난이도: 매우 어려움 (Very Hard)
 * API 라우트 핸들러 통합 테스트: 인증, 권한, 유효성검증, DB 작업을 모킹하여
 * 실제 API 흐름을 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks (vi.hoisted로 호이스팅 안전하게 처리) ───

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, POST } from '@/app/api/v1/inventory/items/route'

// 인증된 세션 헬퍼
function setAuthenticatedSession(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['관리자'],
      permissions: [
        { module: 'inventory', action: 'read' },
        { module: 'inventory', action: 'create' },
      ],
      employeeId: 'emp-1',
      employeeName: '테스트',
      departmentName: '개발팀',
      positionName: '사원',
      accountType: 'INTERNAL',
      ...overrides,
    },
  })
}

function setUnauthenticated() {
  mockAuth.mockResolvedValue(null)
}

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

describe('GET /api/v1/inventory/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('인증되지 않은 요청은 401', async () => {
    setUnauthenticated()
    const req = createRequest('http://localhost/api/v1/inventory/items')
    const resp = await GET(req)
    const body = await resp.json()

    expect(resp.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('권한 없는 사용자는 403', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'user-2',
        roles: [],
        permissions: [], // inventory 읽기 권한 없음
      },
    })
    const req = createRequest('http://localhost/api/v1/inventory/items')
    const resp = await GET(req)
    const body = await resp.json()

    expect(resp.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('정상 조회: 품목 목록 + 페이지네이션', async () => {
    setAuthenticatedSession()

    const items = [
      { id: '1', itemCode: 'ITM-001', itemName: '테스트 품목', category: null },
      { id: '2', itemCode: 'ITM-002', itemName: '테스트 품목 2', category: { id: 'c1', code: 'CAT', name: '분류' } },
    ]
    mockPrisma.item.findMany.mockResolvedValue(items)
    mockPrisma.item.count.mockResolvedValue(2)

    const req = createRequest('http://localhost/api/v1/inventory/items?page=1&pageSize=20')
    const resp = await GET(req)
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.meta).toEqual({ page: 1, pageSize: 20, totalCount: 2, totalPages: 1 })
  })

  it('검색 필터 적용', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findMany.mockResolvedValue([])
    mockPrisma.item.count.mockResolvedValue(0)

    const req = createRequest('http://localhost/api/v1/inventory/items?search=테스트')
    await GET(req)

    // findMany에 검색 조건이 전달되었는지 확인
    const callArgs = mockPrisma.item.findMany.mock.calls[0][0]
    expect(callArgs.where).toHaveProperty('OR')
    expect(callArgs.where.OR).toHaveLength(3) // itemCode, itemName, barcode
  })

  it('itemType 필터 적용', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findMany.mockResolvedValue([])
    mockPrisma.item.count.mockResolvedValue(0)

    const req = createRequest('http://localhost/api/v1/inventory/items?itemType=RAW_MATERIAL')
    await GET(req)

    const callArgs = mockPrisma.item.findMany.mock.calls[0][0]
    expect(callArgs.where.itemType).toBe('RAW_MATERIAL')
  })

  it('isActive 필터: true → boolean 변환', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findMany.mockResolvedValue([])
    mockPrisma.item.count.mockResolvedValue(0)

    const req = createRequest('http://localhost/api/v1/inventory/items?isActive=true')
    await GET(req)

    const callArgs = mockPrisma.item.findMany.mock.calls[0][0]
    expect(callArgs.where.isActive).toBe(true)
  })

  it('페이지네이션: skip 계산', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findMany.mockResolvedValue([])
    mockPrisma.item.count.mockResolvedValue(100)

    const req = createRequest('http://localhost/api/v1/inventory/items?page=3&pageSize=25')
    await GET(req)

    const callArgs = mockPrisma.item.findMany.mock.calls[0][0]
    expect(callArgs.skip).toBe(50) // (3-1) * 25
    expect(callArgs.take).toBe(25)
  })

  it('DB 에러 시 에러 응답', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findMany.mockRejectedValue(new Error('Connection refused'))
    mockPrisma.item.count.mockRejectedValue(new Error('Connection refused'))

    const req = createRequest('http://localhost/api/v1/inventory/items')
    const resp = await GET(req)
    const body = await resp.json()

    expect(resp.status).toBe(500)
    expect(body.success).toBe(false)
  })
})

describe('POST /api/v1/inventory/items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('인증되지 않은 요청은 401', async () => {
    setUnauthenticated()
    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ itemCode: 'ITM-001', itemName: '테스트' }),
    })
    const resp = await POST(req)
    expect(resp.status).toBe(401)
  })

  it('유효한 품목 생성', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findUnique.mockResolvedValue(null) // 중복 없음
    const created = { id: 'new-1', itemCode: 'ITM-001', itemName: '테스트 품목' }
    mockPrisma.item.create.mockResolvedValue(created)

    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ itemCode: 'ITM-001', itemName: '테스트 품목' }),
    })
    const resp = await POST(req)
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.itemCode).toBe('ITM-001')
  })

  it('중복 품목코드 → 409 DUPLICATE', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findUnique.mockResolvedValue({ id: 'existing', itemCode: 'ITM-001' })

    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ itemCode: 'ITM-001', itemName: '테스트' }),
    })
    const resp = await POST(req)
    const body = await resp.json()

    expect(resp.status).toBe(409)
    expect(body.error.code).toBe('DUPLICATE')
  })

  it('유효성 검증 실패 → 400 VALIDATION_ERROR', async () => {
    setAuthenticatedSession()

    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ itemCode: '', itemName: '' }), // 빈 값
    })
    const resp = await POST(req)
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('잘못된 품목코드 패턴 → 400', async () => {
    setAuthenticatedSession()

    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ itemCode: '한글코드', itemName: '테스트' }),
    })
    const resp = await POST(req)
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('잘못된 JSON body → 400 INVALID_JSON', async () => {
    setAuthenticatedSession()

    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: 'not valid json{{{',
      headers: { 'Content-Type': 'application/json' },
    })
    const resp = await POST(req)
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_JSON')
  })

  it('Prisma 중복키 에러 (P2002) → 400 DATABASE_ERROR', async () => {
    setAuthenticatedSession()
    mockPrisma.item.findUnique.mockResolvedValue(null)
    mockPrisma.item.create.mockRejectedValue({ code: 'P2002', meta: { field_name: 'itemCode' } })

    const req = createRequest('http://localhost/api/v1/inventory/items', {
      method: 'POST',
      body: JSON.stringify({ itemCode: 'ITM-001', itemName: '테스트' }),
    })
    const resp = await POST(req)
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('DATABASE_ERROR')
  })
})
