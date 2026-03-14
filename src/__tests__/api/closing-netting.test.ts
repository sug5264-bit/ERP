/**
 * 난이도: 어려움 (Hard)
 * 상계 처리 API 테스트 (매출채권/매입채무)
 * - 거래처별 채권/채무 집계
 * - 상계 전표 생성 (원자적 트랜잭션)
 * - 회계연도 검증
 * - 계정과목 검증
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    voucherDetail: { findMany: vi.fn() },
    fiscalYear: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    accountSubject: { findUnique: vi.fn() },
    voucher: { create: vi.fn() },
    documentSequence: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, POST } from '@/app/api/v1/closing/netting/route'

function setAuth() {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
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

// ─── GET (상계 현황 조회) ───

describe('GET /api/v1/closing/netting', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/closing/netting'))
    expect(resp.status).toBe(401)
  })

  it('정상 조회: 거래처별 채권/채무 집계', async () => {
    setAuth()
    mockPrisma.voucherDetail.findMany.mockResolvedValue([
      {
        partner: { id: 'p-1', partnerCode: 'PTN-001', partnerName: '테스트거래처' },
        accountSubject: { code: '1100', nameKo: '매출채권' },
        voucher: { voucherNo: 'VOU-001', voucherDate: new Date(), voucherType: 'SALES' },
        debitAmount: 1000000,
        creditAmount: 0,
        description: '매출',
      },
      {
        partner: { id: 'p-1', partnerCode: 'PTN-001', partnerName: '테스트거래처' },
        accountSubject: { code: '2100', nameKo: '매입채무' },
        voucher: { voucherNo: 'VOU-002', voucherDate: new Date(), voucherType: 'PURCHASE' },
        debitAmount: 0,
        creditAmount: 500000,
        description: '매입',
      },
    ])
    const resp = await GET(createReq('http://localhost/api/v1/closing/netting?year=2026&month=3'))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].receivable).toBe(1000000)
    expect(body.data[0].payable).toBe(500000)
    expect(body.data[0].netAmount).toBe(500000)
  })

  it('거래처 없는 전표 항목 → 스킵', async () => {
    setAuth()
    mockPrisma.voucherDetail.findMany.mockResolvedValue([
      {
        partner: null,
        accountSubject: { code: '1100', nameKo: '매출채권' },
        voucher: { voucherNo: 'VOU-001', voucherDate: new Date(), voucherType: 'SALES' },
        debitAmount: 1000,
        creditAmount: 0,
        description: null,
      },
    ])
    const resp = await GET(createReq('http://localhost/api/v1/closing/netting'))
    const body = await resp.json()
    expect(body.data).toHaveLength(0)
  })

  it('연도/월 범위 밖 → 현재 날짜로 폴백', async () => {
    setAuth()
    mockPrisma.voucherDetail.findMany.mockResolvedValue([])
    await GET(createReq('http://localhost/api/v1/closing/netting?year=1900&month=13'))
    const callArgs = mockPrisma.voucherDetail.findMany.mock.calls[0][0]
    const voucherDate = callArgs.where.voucher.voucherDate
    // 올바른 범위로 폴백되었는지 확인
    expect(voucherDate.gte).toBeInstanceOf(Date)
    expect(voucherDate.lte).toBeInstanceOf(Date)
    expect(voucherDate.gte.getTime()).toBeLessThan(voucherDate.lte.getTime())
  })
})

// ─── POST (상계 전표 생성) ───

describe('POST /api/v1/closing/netting', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/closing/netting', {
        partnerId: 'p-1',
        amount: 100000,
        nettingDate: '2026-03-01',
      })
    )
    expect(resp.status).toBe(401)
  })

  it('활성 회계연도 없음 → 에러', async () => {
    setAuth()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/closing/netting', {
        partnerId: 'p-1',
        amount: 100000,
        nettingDate: '2026-03-01',
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('NO_FISCAL_YEAR')
  })

  it('사원 정보 미연결 → 에러', async () => {
    setAuth()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: null })
    const resp = await POST(
      createReq('http://localhost/api/v1/closing/netting', {
        partnerId: 'p-1',
        amount: 100000,
        nettingDate: '2026-03-01',
      })
    )
    const body = await resp.json()
    expect(body.error.code).toBe('NO_EMPLOYEE')
  })

  it('계정과목 없음 → 404', async () => {
    setAuth()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 'emp-1' })
    mockPrisma.accountSubject.findUnique.mockResolvedValue(null) // 계정과목 없음
    const resp = await POST(
      createReq('http://localhost/api/v1/closing/netting', {
        partnerId: 'p-1',
        amount: 100000,
        nettingDate: '2026-03-01',
      })
    )
    expect(resp.status).toBe(404)
  })

  it('정상 상계 전표 생성', async () => {
    setAuth()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 'emp-1' })
    mockPrisma.accountSubject.findUnique
      .mockResolvedValueOnce({ id: 'acc-1100', code: '1100' }) // 매출채권
      .mockResolvedValueOnce({ id: 'acc-2100', code: '2100' }) // 매입채무

    const mockVoucher = {
      id: 'voucher-1',
      voucherNo: 'VOU-001',
      voucherType: 'TRANSFER',
      totalDebit: 100000,
      totalCredit: 100000,
      details: [
        { lineNo: 1, debitAmount: 100000, creditAmount: 0 },
        { lineNo: 2, debitAmount: 0, creditAmount: 100000 },
      ],
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        voucher: { create: vi.fn().mockResolvedValue(mockVoucher) },
        documentSequence: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ lastSeq: 1 }) },
      }
      return fn(tx)
    })

    const resp = await POST(
      createReq('http://localhost/api/v1/closing/netting', {
        partnerId: 'p-1',
        amount: 100000,
        nettingDate: '2026-03-01',
        description: '3월 상계',
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.totalDebit).toBe(100000)
    expect(body.data.totalCredit).toBe(100000)
  })
})
