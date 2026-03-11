/**
 * 난이도: 매우 어려움 (Very Hard)
 * 납품 상태 전이 API (GET/PUT/PATCH/DELETE) 통합 테스트
 * 상태 머신: PREPARING → SHIPPED → DELIVERED (역방향 불가)
 * DELETE: 출하 전 상태만 삭제 가능, 재고/발주 복원
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    delivery: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    salesOrderDetail: { updateMany: vi.fn() },
    salesOrder: { update: vi.fn() },
    stockMovement: { findMany: vi.fn(), deleteMany: vi.fn() },
    stockMovementDetail: { findMany: vi.fn(), deleteMany: vi.fn() },
    stockBalance: { updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    qualityInspectionItem: { deleteMany: vi.fn() },
    qualityInspection: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
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

import { GET, PUT, PATCH, DELETE } from '@/app/api/v1/sales/deliveries/[id]/route'

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

const params = Promise.resolve({ id: 'dlv-1' })

// ─── GET ───

describe('GET /api/v1/sales/deliveries/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 납품 → 404', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    expect(resp.status).toBe(404)
  })

  it('정상 조회', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({
      id: 'dlv-1',
      deliveryNo: 'DLV-001',
      status: 'PREPARING',
      salesOrder: { orderNo: 'SO-001' },
      details: [],
    })
    const resp = await GET(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.deliveryNo).toBe('DLV-001')
  })
})

// ─── PUT 상태 전이 ───

describe('PUT /api/v1/sales/deliveries/[id] - 상태 전이', () => {
  beforeEach(() => vi.resetAllMocks())

  it('PREPARING → SHIPPED (허용)', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING' })
    mockPrisma.delivery.update.mockResolvedValue({ id: 'dlv-1', status: 'SHIPPED' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'SHIPPED' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.status).toBe('SHIPPED')
  })

  it('PREPARING → DELIVERED (허용 - 직접 완료)', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING' })
    mockPrisma.delivery.update.mockResolvedValue({ id: 'dlv-1', status: 'DELIVERED' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'DELIVERED' }),
      }),
      { params }
    )
    expect(resp.status).toBe(200)
  })

  it('SHIPPED → DELIVERED (허용)', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'SHIPPED' })
    mockPrisma.delivery.update.mockResolvedValue({ id: 'dlv-1', status: 'DELIVERED' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'DELIVERED' }),
      }),
      { params }
    )
    expect(resp.status).toBe(200)
  })

  it('SHIPPED → PREPARING (역방향 불가)', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'SHIPPED' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'PREPARING' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })

  it('DELIVERED → SHIPPED (역방향 불가)', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'DELIVERED' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'SHIPPED' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })

  it('유효하지 않은 상태값 → VALIDATION_ERROR', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'INVALID_STATUS' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('동일 상태 전이: status 변경 없이 다른 필드만 수정', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING' })
    mockPrisma.delivery.update.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING', deliveryDate: '2024-07-01' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PUT',
        body: JSON.stringify({ deliveryDate: '2024-07-01' }),
      }),
      { params }
    )
    expect(resp.status).toBe(200)
  })
})

// ─── PATCH Tests ───

describe('PATCH /api/v1/sales/deliveries/[id] - 수주확인/출하완료', () => {
  beforeEach(() => vi.resetAllMocks())

  it('수주 확인 체크', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING' })
    mockPrisma.delivery.update.mockResolvedValue({
      id: 'dlv-1',
      orderConfirmed: true,
      orderConfirmedAt: new Date(),
    })

    const resp = await PATCH(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PATCH',
        body: JSON.stringify({ orderConfirmed: true }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.orderConfirmed).toBe(true)
  })

  it('출하 완료 체크', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'PREPARING' })
    mockPrisma.delivery.update.mockResolvedValue({
      id: 'dlv-1',
      shipmentCompleted: true,
      shipmentCompletedAt: new Date(),
    })

    const resp = await PATCH(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PATCH',
        body: JSON.stringify({ shipmentCompleted: true }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.shipmentCompleted).toBe(true)
  })

  it('온라인 매출 정보 업데이트', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'DELIVERED' })
    mockPrisma.delivery.update.mockResolvedValue({
      id: 'dlv-1',
      actualRevenue: 50000,
      platformFee: 5000,
      revenueNote: '네이버 스마트스토어',
    })

    const resp = await PATCH(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PATCH',
        body: JSON.stringify({ actualRevenue: 50000, platformFee: 5000, revenueNote: '네이버 스마트스토어' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.actualRevenue).toBe(50000)
  })

  it('PATCH에서도 상태 전이 검증', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'DELIVERED' })

    const resp = await PATCH(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PREPARING' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_TRANSITION')
  })
})

// ─── DELETE Tests ───

describe('DELETE /api/v1/sales/deliveries/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 납품 → 404', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    expect(resp.status).toBe(404)
  })

  it('SHIPPED 상태 삭제 불가 → 400', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'SHIPPED', details: [] })
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('DELIVERED 상태 삭제 불가 → 400', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', status: 'DELIVERED', details: [] })
    const resp = await DELETE(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('PREPARING 상태 정상 삭제 + 재고/발주 복원', async () => {
    setAuthenticated()
    mockPrisma.delivery.findUnique.mockResolvedValue({
      id: 'dlv-1',
      status: 'PREPARING',
      salesOrderId: 'order-1',
      details: [{ itemId: 'item-1', quantity: 10 }],
    })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        salesOrderDetail: {
          updateMany: vi.fn(),
          findMany: vi.fn().mockResolvedValue([{ remainingQty: 10, deliveredQty: 0 }]),
        },
        salesOrder: { update: vi.fn() },
        stockMovement: {
          findMany: vi.fn().mockResolvedValue([{ id: 'sm-1', sourceWarehouseId: 'wh-1' }]),
          deleteMany: vi.fn(),
        },
        stockMovementDetail: {
          findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', quantity: 10, stockMovementId: 'sm-1' }]),
          deleteMany: vi.fn(),
        },
        stockBalance: { updateMany: vi.fn() },
        qualityInspectionItem: { deleteMany: vi.fn() },
        qualityInspection: { deleteMany: vi.fn() },
        delivery: { delete: vi.fn() },
      }
      return fn(tx)
    })

    const resp = await DELETE(createReq('http://localhost/api/v1/sales/deliveries/dlv-1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.id).toBe('dlv-1')
  })
})
