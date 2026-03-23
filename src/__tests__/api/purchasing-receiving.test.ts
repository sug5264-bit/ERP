/**
 * 난이도: 매우 어려움 (Very Hard)
 * 구매입고 API 테스트
 * - 구매발주 상태 검증 (취소/완료 불가)
 * - 입고 수량 > 발주 잔량 초과 방지
 * - 품목 자동 생성 (ensureItemExists)
 * - 재고이동 자동 생성 (createAutoStockMovement)
 * - 발주 상태 자동 변경 (IN_PROGRESS / COMPLETED)
 * - 트랜잭션 일관성
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockEnsureItemExists, mockCreateAutoStockMovement } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    receiving: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    purchaseOrder: { findUnique: vi.fn(), update: vi.fn() },
    purchaseOrderDetail: { findMany: vi.fn(), updateMany: vi.fn() },
    employee: { findFirst: vi.fn() },
    documentSequence: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  mockEnsureItemExists: vi.fn(),
  mockCreateAutoStockMovement: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))
vi.mock('@/lib/auto-sync', () => ({
  ensureItemExists: (...args: unknown[]) => mockEnsureItemExists(...args),
  createAutoStockMovement: (...args: unknown[]) => mockCreateAutoStockMovement(...args),
}))

import { GET, POST } from '@/app/api/v1/purchasing/receiving/route'

function setAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
        { module: 'purchasing', action: 'read' },
        { module: 'purchasing', action: 'create' },
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

describe('GET /api/v1/purchasing/receiving', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/purchasing/receiving'))
    expect(resp.status).toBe(401)
  })

  it('정상 조회: 페이지네이션 포함', async () => {
    setAuth()
    mockPrisma.receiving.findMany.mockResolvedValue([
      {
        id: 'rcv-1',
        receivingNo: 'RCV-001',
        receivingDate: new Date(),
        status: 'RECEIVED',
        purchaseOrder: { orderNo: 'PO-001' },
        partner: { partnerName: '공급사' },
        details: [],
        inspectedBy: null,
      },
    ])
    mockPrisma.receiving.count.mockResolvedValue(1)
    const resp = await GET(createReq('http://localhost/api/v1/purchasing/receiving'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].orderNo).toBe('PO-001')
  })

  it('상태 필터', async () => {
    setAuth()
    mockPrisma.receiving.findMany.mockResolvedValue([])
    mockPrisma.receiving.count.mockResolvedValue(0)
    await GET(createReq('http://localhost/api/v1/purchasing/receiving?status=INSPECTED'))
    const where = mockPrisma.receiving.findMany.mock.calls[0][0].where
    expect(where.status).toBe('INSPECTED')
  })
})

// ─── POST ───

describe('POST /api/v1/purchasing/receiving', () => {
  beforeEach(() => vi.resetAllMocks())

  const validData = {
    purchaseOrderId: 'po-1',
    receivingDate: '2026-03-01',
    details: [{ itemId: 'item-1', quantity: 10, unitPrice: 1000 }],
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 구매발주 → 404', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null)
    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    expect(resp.status).toBe(404)
  })

  it('취소된 구매발주 → 400', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'CANCELLED' })
    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('완료된 구매발주 → 400', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'COMPLETED' })
    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('사원 정보 없음 → 404', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'PENDING' })
    mockPrisma.employee.findFirst.mockResolvedValue(null)
    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    expect(resp.status).toBe(404)
  })

  it('입고 수량 > 잔량 → 에러', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'PENDING' })
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    mockEnsureItemExists.mockResolvedValue('item-1')
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        purchaseOrderDetail: {
          findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', remainingQty: 5, unitPrice: 1000 }]),
          updateMany: vi.fn(),
        },
        receiving: { create: vi.fn() },
        purchaseOrder: { update: vi.fn() },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }),
        },
      }
      return fn(tx)
    })
    const resp = await POST(
      createReq('http://localhost/api/v1/purchasing/receiving', {
        ...validData,
        details: [{ itemId: 'item-1', quantity: 20, unitPrice: 1000 }], // 잔량 5보다 큼
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.message).toContain('잔량을 초과')
  })

  it('발주에 없는 품목 → 에러', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'PENDING' })
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    mockEnsureItemExists.mockResolvedValue('item-unknown')
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        purchaseOrderDetail: {
          findMany: vi.fn().mockResolvedValue([{ itemId: 'item-1', remainingQty: 10, unitPrice: 1000 }]),
          updateMany: vi.fn(),
        },
        receiving: { create: vi.fn() },
        purchaseOrder: { update: vi.fn() },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }),
        },
      }
      return fn(tx)
    })
    const resp = await POST(
      createReq('http://localhost/api/v1/purchasing/receiving', {
        ...validData,
        details: [{ itemId: 'item-unknown', quantity: 5, unitPrice: 500 }],
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.message).toContain('포함되지 않은 품목')
  })

  it('정상 입고: 잔량 0 → 발주 COMPLETED', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'PENDING' })
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    mockEnsureItemExists.mockResolvedValue('item-1')
    mockCreateAutoStockMovement.mockResolvedValue(undefined)

    const mockReceiving = {
      id: 'rcv-1',
      receivingNo: 'RCV-001',
      details: [{ itemId: 'item-1', receivedQty: 10 }],
      partner: { partnerName: '공급사' },
      purchaseOrder: { orderNo: 'PO-001' },
    }
    const mockPOUpdate = vi.fn()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        purchaseOrderDetail: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ itemId: 'item-1', remainingQty: 10, unitPrice: 1000 }]) // 검증용
            .mockResolvedValueOnce([]), // 잔량 체크 → 빈 배열 = 전부 입고 완료
          updateMany: vi.fn(),
        },
        receiving: { create: vi.fn().mockResolvedValue(mockReceiving) },
        purchaseOrder: { update: mockPOUpdate },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }),
        },
      }
      return fn(tx)
    })

    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.receivingNo).toBe('RCV-001')
    // COMPLETED로 상태 변경 확인
    expect(mockPOUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'COMPLETED' } }))
  })

  it('정상 입고: 부분 입고 → 발주 IN_PROGRESS', async () => {
    setAuth()
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'po-1', partnerId: 'p-1', status: 'PENDING' })
    mockPrisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' })
    mockEnsureItemExists.mockResolvedValue('item-1')
    mockCreateAutoStockMovement.mockResolvedValue(undefined)

    const mockPOUpdate = vi.fn()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        purchaseOrderDetail: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([{ itemId: 'item-1', remainingQty: 20, unitPrice: 1000 }])
            .mockResolvedValueOnce([{ itemId: 'item-1', remainingQty: 10 }]), // 잔량 남음
          updateMany: vi.fn(),
        },
        receiving: {
          create: vi.fn().mockResolvedValue({
            id: 'rcv-2',
            receivingNo: 'RCV-002',
            details: [],
            partner: { partnerName: '공급사' },
            purchaseOrder: { orderNo: 'PO-001' },
          }),
        },
        purchaseOrder: { update: mockPOUpdate },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 2 }),
        },
      }
      return fn(tx)
    })

    const resp = await POST(createReq('http://localhost/api/v1/purchasing/receiving', validData))
    expect(resp.status).toBe(200)
    expect(mockPOUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'IN_PROGRESS' } }))
  })
})
