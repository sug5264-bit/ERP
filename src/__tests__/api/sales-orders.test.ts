/**
 * 난이도: 매우 어려움 (Very Hard)
 * 판매 주문 API 라우트 핸들러 통합 테스트
 * GET: 인증, 필터링(상태/채널/날짜/금액/거래처/검색), 페이지네이션
 * POST: 인증, 유효성검증, 거래처/품목 자동생성, 재고체크, 세금계산, 트랜잭션
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ───

const { mockAuth, mockPrisma, mockGenerateDocNo, mockEnsurePartner, mockEnsureItem } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    salesOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    employee: { findFirst: vi.fn() },
    item: { findMany: vi.fn() },
    stockBalance: { groupBy: vi.fn() },
    salesOrderDetail: { groupBy: vi.fn() },
    quotation: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  mockGenerateDocNo: vi.fn(),
  mockEnsurePartner: vi.fn(),
  mockEnsureItem: vi.fn(),
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

vi.mock('@/lib/doc-number', () => ({
  generateDocumentNumber: (...args: unknown[]) => mockGenerateDocNo(...args),
}))

vi.mock('@/lib/auto-sync', () => ({
  ensurePartnerExists: (...args: unknown[]) => mockEnsurePartner(...args),
  ensureItemExists: (...args: unknown[]) => mockEnsureItem(...args),
}))

import { GET, POST } from '@/app/api/v1/sales/orders/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['관리자'],
      permissions: [
        { module: 'sales', action: 'read' },
        { module: 'sales', action: 'create' },
      ],
      employeeId: 'emp-1',
      employeeName: '테스트',
      departmentName: '영업팀',
      positionName: '대리',
      accountType: 'INTERNAL',
      ...overrides,
    },
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

// ─── GET Tests ───

describe('GET /api/v1/sales/orders', () => {
  beforeEach(() => vi.clearAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/sales/orders'))
    expect(resp.status).toBe(401)
  })

  it('권한 없는 사용자 → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-2', roles: [], permissions: [] },
    })
    const resp = await GET(createReq('http://localhost/api/v1/sales/orders'))
    expect(resp.status).toBe(403)
  })

  it('정상 조회: 주문 목록 + 페이지네이션', async () => {
    setAuthenticated()
    const orders = [
      { id: '1', orderNo: 'SO-2024-001', status: 'ORDERED' },
      { id: '2', orderNo: 'SO-2024-002', status: 'DELIVERED' },
    ]
    mockPrisma.salesOrder.findMany.mockResolvedValue(orders)
    mockPrisma.salesOrder.count.mockResolvedValue(2)

    const resp = await GET(createReq('http://localhost/api/v1/sales/orders?page=1&pageSize=20'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.meta).toEqual({ page: 1, pageSize: 20, totalCount: 2, totalPages: 1 })
  })

  it('status 필터 적용', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?status=ORDERED'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.status).toBe('ORDERED')
  })

  it('salesChannel 필터 적용', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?salesChannel=ONLINE'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.salesChannel).toBe('ONLINE')
  })

  it('날짜 범위 필터', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?startDate=2024-01-01&endDate=2024-12-31'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.orderDate).toBeDefined()
    expect(callArgs.where.orderDate.gte).toEqual(new Date('2024-01-01'))
    expect(callArgs.where.orderDate.lte).toEqual(new Date('2024-12-31'))
  })

  it('잘못된 날짜는 필터에서 무시', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?startDate=invalid'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    // orderDate 필터는 설정되지만 gte는 undefined (NaN Date 무시)
    expect(callArgs.where.orderDate?.gte).toBeUndefined()
  })

  it('금액 범위 필터', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?minAmount=10000&maxAmount=50000'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.totalAmount).toEqual({ gte: 10000, lte: 50000 })
  })

  it('NaN 금액은 필터에서 무시', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?minAmount=abc'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.totalAmount).toBeUndefined()
  })

  it('거래처 필터', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?partnerId=partner-1'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.partnerId).toBe('partner-1')
  })

  it('검색 필터: 주문번호 또는 거래처명', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders?search=테스트'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.where.OR).toHaveLength(2)
  })

  it('페이지네이션 skip 계산', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(100)

    await GET(createReq('http://localhost/api/v1/sales/orders?page=4&pageSize=10'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.skip).toBe(30)
    expect(callArgs.take).toBe(10)
  })

  it('include에 partner, employee, quotation, details 포함', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockResolvedValue([])
    mockPrisma.salesOrder.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/sales/orders'))

    const callArgs = mockPrisma.salesOrder.findMany.mock.calls[0][0]
    expect(callArgs.include.partner).toBeDefined()
    expect(callArgs.include.employee).toBeDefined()
    expect(callArgs.include.quotation).toBeDefined()
    expect(callArgs.include.details).toBeDefined()
  })

  it('DB 에러 → 500', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findMany.mockRejectedValue(new Error('Connection refused'))
    mockPrisma.salesOrder.count.mockRejectedValue(new Error('Connection refused'))

    const resp = await GET(createReq('http://localhost/api/v1/sales/orders'))
    expect(resp.status).toBe(500)
  })
})

// ─── POST Tests ───

describe('POST /api/v1/sales/orders', () => {
  beforeEach(() => vi.clearAllMocks())

  const validBody = {
    orderDate: '2024-06-15',
    partnerId: 'partner-1',
    details: [{ itemId: 'item-1', quantity: 10, unitPrice: 1000 }],
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    expect(resp.status).toBe(401)
  })

  it('유효성 검증 실패: orderDate 누락 → 400', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify({ details: [] }),
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('유효성 검증 실패: details 빈 배열 → 400', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify({ orderDate: '2024-06-15', details: [] }),
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('유효성 검증 실패: 잘못된 날짜 형식 → 400', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify({
          orderDate: '2024/06/15',
          details: [{ itemId: 'item-1', quantity: 1, unitPrice: 100 }],
        }),
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('employeeId 없으면 DB에서 조회', async () => {
    setAuthenticated({ employeeId: null })
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-from-db' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrder: { create: vi.fn().mockResolvedValue({ id: 'order-1', orderNo: 'SO-001' }) },
        quotation: { update: vi.fn() },
        stockBalance: { groupBy: vi.fn().mockResolvedValue([]) },
        salesOrderDetail: { groupBy: vi.fn().mockResolvedValue([]) },
        item: { findMany: vi.fn().mockResolvedValue([{ id: 'item-1', itemName: '품목1', taxType: 'TAXABLE' }]) },
      }
      return fn(tx)
    })
    mockEnsurePartner.mockResolvedValue('partner-1')
    mockEnsureItem.mockResolvedValue('item-1')
    mockGenerateDocNo.mockResolvedValue('SO-2024-001')

    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('사원 정보 없으면 → 404', async () => {
    setAuthenticated({ employeeId: null })
    mockPrisma.employee.findFirst.mockResolvedValue(null)

    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 주문 생성: 트랜잭션 실행', async () => {
    setAuthenticated()
    const createdOrder = {
      id: 'order-1',
      orderNo: 'SO-2024-001',
      totalAmount: 11000,
      partner: { id: 'partner-1', partnerName: '테스트사' },
      details: [{ itemId: 'item-1', quantity: 10, unitPrice: 1000 }],
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrder: { create: vi.fn().mockResolvedValue(createdOrder) },
        quotation: { update: vi.fn() },
        stockBalance: {
          groupBy: vi.fn().mockResolvedValue([{ itemId: 'item-1', _sum: { quantity: 100 } }]),
        },
        salesOrderDetail: { groupBy: vi.fn().mockResolvedValue([]) },
        item: {
          findMany: vi.fn().mockResolvedValue([{ id: 'item-1', itemName: '품목1', taxType: 'TAXABLE' }]),
        },
      }
      return fn(tx)
    })
    mockEnsurePartner.mockResolvedValue('partner-1')
    mockEnsureItem.mockResolvedValue('item-1')
    mockGenerateDocNo.mockResolvedValue('SO-2024-001')

    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.orderNo).toBe('SO-2024-001')
  })

  it('잘못된 JSON → 400 INVALID_JSON', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/sales/orders', {
        method: 'POST',
        body: 'not json{{{',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_JSON')
  })
})
