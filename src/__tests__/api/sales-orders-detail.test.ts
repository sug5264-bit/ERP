/**
 * 난이도: 매우 어려움 (Very Hard)
 * 판매 주문 상세 API (GET/PUT/DELETE) 통합 테스트
 * PUT: 완료(action=complete), 취소(action=cancel), 수정(action=update)
 * DELETE: 캐스케이드 삭제, 재고 복원, 감사 로그
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockWriteAuditLog } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    salesOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    salesOrderDetail: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    item: { findMany: vi.fn() },
    delivery: { findMany: vi.fn() },
    deliveryDetail: { deleteMany: vi.fn() },
    qualityInspection: { deleteMany: vi.fn() },
    qualityInspectionItem: { deleteMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), deleteMany: vi.fn() },
    stockMovementDetail: { findMany: vi.fn(), deleteMany: vi.fn() },
    stockBalance: { updateMany: vi.fn() },
    salesReturn: { deleteMany: vi.fn() },
    salesReturnDetail: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/audit-log', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
  getClientIp: () => '127.0.0.1',
}))

vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, PUT, DELETE } from '@/app/api/v1/sales/orders/[id]/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
        { module: 'sales', action: 'read' },
        { module: 'sales', action: 'update' },
        { module: 'sales', action: 'delete' },
      ],
      employeeId: 'emp-1',
      accountType: 'INTERNAL',
      ...overrides,
    },
  })
}

function createReq(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost'), options)
}

const params = Promise.resolve({ id: 'order-1' })

// ─── GET Tests ───

describe('GET /api/v1/sales/orders/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 주문 → 404', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 조회', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-001',
      partner: {},
      employee: {},
      details: [],
      deliveries: [],
    })
    const resp = await GET(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.orderNo).toBe('SO-001')
  })
})

// ─── PUT Tests ───

describe('PUT /api/v1/sales/orders/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'complete' }),
      }),
      { params }
    )
    expect(resp.status).toBe(401)
  })

  it('완료 처리: 정상 케이스', async () => {
    setAuthenticated()
    const completedOrder = { id: 'order-1', status: 'COMPLETED' }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrder: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'order-1',
            status: 'ORDERED',
            dispatchInfo: null,
            receivedBy: null,
          }),
          update: vi.fn().mockResolvedValue(completedOrder),
        },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'complete', dispatchInfo: '배차정보', receivedBy: '담당자' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.status).toBe('COMPLETED')
  })

  it('완료 처리: 이미 완료된 발주 → 에러', async () => {
    setAuthenticated()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrder: {
          findUnique: vi.fn().mockResolvedValue({ id: 'order-1', status: 'COMPLETED' }),
        },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'complete', dispatchInfo: '배차', receivedBy: '담당' }),
      }),
      { params }
    )
    // handleApiError는 일반 Error를 400으로 반환
    expect(resp.status).toBe(400)
  })

  it('취소 처리: 정상 케이스', async () => {
    setAuthenticated()
    const cancelled = { id: 'order-1', status: 'CANCELLED' }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrder: {
          findUnique: vi.fn().mockResolvedValue({ id: 'order-1', status: 'ORDERED' }),
          update: vi.fn().mockResolvedValue(cancelled),
        },
        salesOrderDetail: {
          findFirst: vi.fn().mockResolvedValue(null), // 납품 진행 안 됨
        },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.status).toBe('CANCELLED')
  })

  it('취소 처리: 납품 진행 중 → 에러', async () => {
    setAuthenticated()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrder: {
          findUnique: vi.fn().mockResolvedValue({ id: 'order-1', status: 'IN_PROGRESS' }),
        },
        salesOrderDetail: {
          findFirst: vi.fn().mockResolvedValue({ id: 'detail-1', deliveredQty: 5 }),
        },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { params }
    )
    expect(resp.status).toBe(400) // handleApiError wraps thrown Error as 400
  })

  it('수정: 완료/취소 발주 수정 불가 → 400', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'COMPLETED',
      details: [],
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'update', orderDate: '2024-07-01' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('수정: 납품 수량 이하로 변경 불가', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'IN_PROGRESS',
      vatIncluded: true,
      details: [{ itemId: 'item-1', deliveredQty: 5 }],
    })
    mockPrisma.item.findMany.mockResolvedValue([{ id: 'item-1', taxType: 'TAXABLE' }])

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({
          action: 'update',
          orderDate: '2024-07-01',
          details: [{ itemId: 'item-1', quantity: 3, unitPrice: 1000 }], // 3 < deliveredQty 5
        }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('QUANTITY_BELOW_DELIVERED')
  })

  it('지원하지 않는 action → 400', async () => {
    setAuthenticated()
    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/orders/order-1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'unknown' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_ACTION')
  })
})

// ─── DELETE Tests ───

describe('DELETE /api/v1/sales/orders/[id]', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWriteAuditLog.mockReturnValue(Promise.resolve())
  })

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 주문 → 404', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('완료된 발주 삭제 불가 → 400', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'COMPLETED' })
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('정상 삭제: 납품 없는 경우', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'ORDERED' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        delivery: { findMany: vi.fn().mockResolvedValue([]) },
        salesReturnDetail: { deleteMany: vi.fn() },
        salesReturn: { deleteMany: vi.fn() },
        salesOrderDetail: { deleteMany: vi.fn() },
        salesOrder: { delete: vi.fn() },
        note: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      }
      return fn(tx)
    })

    const resp = await DELETE(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.message).toBe('발주가 삭제되었습니다.')
    expect(mockWriteAuditLog).toHaveBeenCalled()
  })

  it('정상 삭제: 납품/재고이동 포함 캐스케이드', async () => {
    setAuthenticated()
    mockPrisma.salesOrder.findUnique.mockResolvedValue({ id: 'order-1', status: 'ORDERED' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        delivery: { findMany: vi.fn().mockResolvedValue([{ id: 'dlv-1' }]), deleteMany: vi.fn() },
        stockMovement: {
          findMany: vi.fn().mockResolvedValue([{ id: 'sm-1', sourceWarehouseId: 'wh-1', targetWarehouseId: null }]),
          deleteMany: vi.fn(),
        },
        stockMovementDetail: {
          findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', quantity: 10, stockMovementId: 'sm-1' }]),
          deleteMany: vi.fn(),
        },
        stockBalance: { updateMany: vi.fn() },
        qualityInspectionItem: { deleteMany: vi.fn() },
        qualityInspection: { deleteMany: vi.fn() },
        deliveryDetail: { deleteMany: vi.fn() },
        salesReturnDetail: { deleteMany: vi.fn() },
        salesReturn: { deleteMany: vi.fn() },
        salesOrderDetail: { deleteMany: vi.fn() },
        salesOrder: { delete: vi.fn() },
        note: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      }
      return fn(tx)
    })

    const resp = await DELETE(createReq('http://localhost/api/v1/sales/orders/order-1'), { params })
    expect(resp.status).toBe(200)
  })
})
