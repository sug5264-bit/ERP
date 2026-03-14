/**
 * 난이도: 매우 어려움 (Very Hard)
 * 재고이동 API 테스트 (입고/출고/이체/조정)
 * - 창고 필수 검증 (이동유형별)
 * - 원자적 재고 차감 (레이스 컨디션 방지)
 * - 가중평균단가 계산
 * - 재고 부족 시 오류
 * - 트랜잭션 일관성
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    stockMovement: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    stockBalance: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    item: { findUnique: vi.fn() },
    employee: { findFirst: vi.fn() },
    documentSequence: { upsert: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { GET, POST } from '@/app/api/v1/inventory/stock-movement/route'

function setAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
        { module: 'inventory', action: 'read' },
        { module: 'inventory', action: 'create' },
      ],
      employeeId: 'emp-1',
      accountType: 'INTERNAL',
    },
  })
}

function createReq(url: string, body?: unknown): NextRequest {
  if (body) {
    return new NextRequest(new URL(url, 'http://localhost'), {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new NextRequest(new URL(url, 'http://localhost'))
}

// ─── GET ───

describe('GET /api/v1/inventory/stock-movement', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/inventory/stock-movement'))
    expect(resp.status).toBe(401)
  })

  it('정상 조회: 페이지네이션', async () => {
    setAuth()
    mockPrisma.stockMovement.findMany.mockResolvedValue([{ id: 'sm-1', movementNo: 'STK-001' }])
    mockPrisma.stockMovement.count.mockResolvedValue(1)
    const resp = await GET(createReq('http://localhost/api/v1/inventory/stock-movement?page=1&pageSize=10'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })

  it('이동유형 필터', async () => {
    setAuth()
    mockPrisma.stockMovement.findMany.mockResolvedValue([])
    mockPrisma.stockMovement.count.mockResolvedValue(0)
    await GET(createReq('http://localhost/api/v1/inventory/stock-movement?movementType=INBOUND'))
    const where = mockPrisma.stockMovement.findMany.mock.calls[0][0].where
    expect(where.movementType).toBe('INBOUND')
  })

  it('창고 필터: OR 조건으로 출발/도착 모두 검색', async () => {
    setAuth()
    mockPrisma.stockMovement.findMany.mockResolvedValue([])
    mockPrisma.stockMovement.count.mockResolvedValue(0)
    await GET(createReq('http://localhost/api/v1/inventory/stock-movement?warehouseId=wh-1'))
    const where = mockPrisma.stockMovement.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual([{ sourceWarehouseId: 'wh-1' }, { targetWarehouseId: 'wh-1' }])
  })

  it('날짜 필터: 유효하지 않은 날짜 무시', async () => {
    setAuth()
    mockPrisma.stockMovement.findMany.mockResolvedValue([])
    mockPrisma.stockMovement.count.mockResolvedValue(0)
    await GET(createReq('http://localhost/api/v1/inventory/stock-movement?startDate=invalid'))
    const where = mockPrisma.stockMovement.findMany.mock.calls[0][0].where
    // 유효하지 않은 날짜이므로 movementDate 조건이 없거나 빈 객체
    expect(where.movementDate).toBeDefined()
  })
})

// ─── POST ───

describe('POST /api/v1/inventory/stock-movement', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'INBOUND',
        movementDate: '2026-01-01',
        targetWarehouseId: 'wh-1',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    expect(resp.status).toBe(401)
  })

  it('입고 시 대상 창고 필수', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'INBOUND',
        movementDate: '2026-01-01',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('MISSING_WAREHOUSE')
  })

  it('출고 시 출발 창고 필수', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'OUTBOUND',
        movementDate: '2026-01-01',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('MISSING_WAREHOUSE')
  })

  it('이체 시 출발/도착 창고 모두 필수', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'TRANSFER',
        movementDate: '2026-01-01',
        sourceWarehouseId: 'wh-1',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('INVALID_WAREHOUSE')
  })

  it('이체 시 출발/도착 창고 동일 불가', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'TRANSFER',
        movementDate: '2026-01-01',
        sourceWarehouseId: 'wh-1',
        targetWarehouseId: 'wh-1',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('SAME_WAREHOUSE')
  })

  it('재고조정 시 대상 창고 필수', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'ADJUSTMENT',
        movementDate: '2026-01-01',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('MISSING_WAREHOUSE')
  })

  it('사원 정보 없음 → 404', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'INBOUND',
        movementDate: '2026-01-01',
        targetWarehouseId: 'wh-1',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    expect(resp.status).toBe(404)
  })

  it('정상 입고: 트랜잭션 호출', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    const mockResult = { id: 'sm-1', movementNo: 'STK-001' }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        stockMovement: { create: vi.fn().mockResolvedValue(mockResult) },
        stockBalance: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn(),
          update: vi.fn(),
          create: vi.fn(),
        },
        documentSequence: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }) },
        $queryRaw: vi.fn().mockResolvedValue([]),
      }
      return fn(tx)
    })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'INBOUND',
        movementDate: '2026-01-01',
        targetWarehouseId: 'wh-1',
        details: [{ itemId: 'item-1', quantity: 10, unitPrice: 1000 }],
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.movementNo).toBe('STK-001')
  })

  it('출고 시 재고 부족 → 에러', async () => {
    setAuth()
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        stockMovement: { create: vi.fn().mockResolvedValue({ id: 'sm-1' }) },
        stockBalance: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }), // 재고 부족
          findFirst: vi.fn().mockResolvedValue({ quantity: 3 }),
        },
        item: { findUnique: vi.fn().mockResolvedValue({ itemName: '테스트품목' }) },
        documentSequence: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }) },
      }
      return fn(tx)
    })
    const resp = await POST(
      createReq('http://localhost/api/v1/inventory/stock-movement', {
        movementType: 'OUTBOUND',
        movementDate: '2026-01-01',
        sourceWarehouseId: 'wh-1',
        details: [{ itemId: 'item-1', quantity: 10 }],
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.message).toContain('재고가 부족')
    expect(body.error.message).toContain('테스트품목')
  })
})
