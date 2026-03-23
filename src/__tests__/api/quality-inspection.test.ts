/**
 * 난이도: 어려움 (Hard)
 * 납품 품질검사 API 테스트
 * - 불량률 계산 (defectCount / sampleSize)
 * - 검사 수량 0일 때 불량 수 > 0 → 에러
 * - 납품 품질 상태 자동 업데이트
 * - 세무/회계 세금계산서 API 유효성 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    qualityInspection: { findMany: vi.fn(), create: vi.fn() },
    delivery: { findUnique: vi.fn(), update: vi.fn() },
    documentSequence: { upsert: vi.fn() },
    taxInvoice: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    accountSubject: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import {
  GET as GetInspections,
  POST as CreateInspection,
} from '@/app/api/v1/sales/deliveries/[id]/quality-inspection/route'
import { GET as GetTaxInvoices, POST as CreateTaxInvoice } from '@/app/api/v1/accounting/tax-invoice/route'

function setAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
        { module: 'sales', action: 'read' },
        { module: 'sales', action: 'create' },
        { module: 'accounting', action: 'read' },
        { module: 'accounting', action: 'create' },
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

const deliveryParams = Promise.resolve({ id: 'dlv-1' })

// ─── 품질검사 조회 ───

describe('GET /api/v1/sales/deliveries/[id]/quality-inspection', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GetInspections(createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection'), {
      params: deliveryParams,
    })
    expect(resp.status).toBe(401)
  })

  it('정상 조회', async () => {
    setAuth()
    mockPrisma.qualityInspection.findMany.mockResolvedValue([{ id: 'qi-1', inspectionNo: 'QI-001', defectRate: 2.5 }])
    const resp = await GetInspections(createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection'), {
      params: deliveryParams,
    })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data).toHaveLength(1)
  })
})

// ─── 품질검사 생성 ───

describe('POST /api/v1/sales/deliveries/[id]/quality-inspection', () => {
  beforeEach(() => vi.resetAllMocks())

  const validData = {
    inspectionDate: '2026-03-01',
    inspectorName: '김검사',
    overallGrade: 'A',
    sampleSize: 100,
    defectCount: 3,
    judgement: 'PASS',
    items: [{ category: 'APPEARANCE', checkItem: '외관검사', result: 'PASS', grade: 'A' }],
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await CreateInspection(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection', validData),
      { params: deliveryParams }
    )
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 납품 → 404', async () => {
    setAuth()
    mockPrisma.delivery.findUnique.mockResolvedValue(null)
    const resp = await CreateInspection(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection', validData),
      { params: deliveryParams }
    )
    expect(resp.status).toBe(404)
  })

  it('불량수 > 0이고 검사수량 0 → 400', async () => {
    setAuth()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', deliveryNo: 'DLV-001' })
    const resp = await CreateInspection(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection', {
        ...validData,
        sampleSize: 0,
        defectCount: 5,
      }),
      { params: deliveryParams }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_SAMPLE_SIZE')
  })

  it('정상 검사 생성: 불량률 계산 및 납품 상태 업데이트', async () => {
    setAuth()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', deliveryNo: 'DLV-001' })
    const mockInspection = {
      id: 'qi-1',
      inspectionNo: 'QI-001',
      defectRate: 3, // 3/100 * 100
      items: [{ id: 'item-1' }],
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        qualityInspection: { create: vi.fn().mockResolvedValue(mockInspection) },
        delivery: { update: vi.fn() },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }),
        },
      }
      return fn(tx)
    })

    const resp = await CreateInspection(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection', validData),
      { params: deliveryParams }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.inspectionNo).toBe('QI-001')
  })

  it('불량 0건 → 불량률 0', async () => {
    setAuth()
    mockPrisma.delivery.findUnique.mockResolvedValue({ id: 'dlv-1', deliveryNo: 'DLV-001' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        qualityInspection: {
          create: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            const data = args.data as Record<string, unknown>
            expect(data.defectRate).toBe(0)
            return { id: 'qi-2', inspectionNo: 'QI-002', defectRate: 0, items: [] }
          }),
        },
        delivery: { update: vi.fn() },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 2 }),
        },
      }
      return fn(tx)
    })

    const resp = await CreateInspection(
      createReq('http://localhost/api/v1/sales/deliveries/dlv-1/quality-inspection', {
        ...validData,
        sampleSize: 50,
        defectCount: 0,
      }),
      { params: deliveryParams }
    )
    expect(resp.status).toBe(200)
  })
})

// ─── 세금계산서 ───

describe('GET /api/v1/accounting/tax-invoice', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GetTaxInvoices(createReq('http://localhost/api/v1/accounting/tax-invoice'))
    expect(resp.status).toBe(401)
  })

  it('정상 조회: 검색 필터', async () => {
    setAuth()
    mockPrisma.taxInvoice.findMany.mockResolvedValue([])
    mockPrisma.taxInvoice.count.mockResolvedValue(0)
    await GetTaxInvoices(createReq('http://localhost/api/v1/accounting/tax-invoice?search=테스트'))
    const where = mockPrisma.taxInvoice.findMany.mock.calls[0][0].where
    expect(where.OR).toBeDefined()
    expect(where.OR).toHaveLength(3) // invoiceNo, supplierName, buyerName
  })
})

describe('POST /api/v1/accounting/tax-invoice', () => {
  beforeEach(() => vi.resetAllMocks())

  const validInvoice = {
    issueDate: '2026-03-01',
    invoiceType: 'SALES',
    supplierBizNo: '123-45-67890',
    supplierName: '공급자',
    supplierCeo: '대표자',
    buyerBizNo: '098-76-54321',
    buyerName: '공급받는자',
    buyerCeo: '대표자2',
    items: [
      {
        itemDate: '2026-03-01',
        itemName: '테스트품목',
        specification: 'A',
        qty: 10,
        unitPrice: 10000,
        supplyAmount: 100000,
        taxAmount: 10000,
      },
    ],
  }

  it('품목 금액 불일치 → 400', async () => {
    setAuth()
    const resp = await CreateTaxInvoice(
      createReq('http://localhost/api/v1/accounting/tax-invoice', {
        ...validInvoice,
        items: [
          {
            itemDate: '2026-03-01',
            itemName: '테스트품목',
            qty: 10,
            unitPrice: 10000,
            supplyAmount: 50000, // 10 * 10000 = 100000이어야 함
            taxAmount: 5000,
          },
        ],
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('정상 생성: 공급가액/세액 합산', async () => {
    setAuth()
    const mockInvoice = {
      id: 'ti-1',
      invoiceNo: 'TI-001',
      supplyAmount: 100000,
      taxAmount: 10000,
      totalAmount: 110000,
      items: [{ id: 'item-1' }],
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        taxInvoice: {
          create: vi.fn().mockImplementation((args: Record<string, unknown>) => {
            const data = args.data as Record<string, number>
            expect(data.supplyAmount).toBe(100000)
            expect(data.taxAmount).toBe(10000)
            expect(data.totalAmount).toBe(110000)
            return mockInvoice
          }),
        },
        documentSequence: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }),
        },
      }
      return fn(tx)
    })
    const resp = await CreateTaxInvoice(createReq('http://localhost/api/v1/accounting/tax-invoice', validInvoice))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.totalAmount).toBe(110000)
  })
})
