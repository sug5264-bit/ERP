/**
 * 난이도: 매우 어려움 (Very Hard)
 * 회계 전표 API 라우트 핸들러 통합 테스트
 * GET: 인증, 필터링(유형/상태/날짜/검색), 페이지네이션
 * POST: 인증, 유효성검증, 계정코드 해소, 차대변 균형, 회계연도, 사원연결, 트랜잭션
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockGenerateDocNo } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    voucher: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    accountSubject: { findMany: vi.fn() },
    fiscalYear: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  mockGenerateDocNo: vi.fn(),
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

import { GET, POST } from '@/app/api/v1/accounting/vouchers/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['관리자'],
      permissions: [
        { module: 'accounting', action: 'read' },
        { module: 'accounting', action: 'create' },
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

// ─── GET Tests ───

describe('GET /api/v1/accounting/vouchers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers'))
    expect(resp.status).toBe(401)
  })

  it('권한 없는 사용자 → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-2', roles: [], permissions: [] },
    })
    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers'))
    expect(resp.status).toBe(403)
  })

  it('정상 조회: 전표 목록 + 페이지네이션', async () => {
    setAuthenticated()
    const vouchers = [
      { id: '1', voucherNo: 'VOU-001', voucherType: 'RECEIPT', createdBy: { nameKo: '홍길동' } },
      { id: '2', voucherNo: 'VOU-002', voucherType: 'PAYMENT', createdBy: { nameKo: '김영희' } },
    ]
    mockPrisma.voucher.findMany.mockResolvedValue(vouchers)
    mockPrisma.voucher.count.mockResolvedValue(2)

    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers?page=1&pageSize=20'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.meta).toEqual({ page: 1, pageSize: 20, totalCount: 2, totalPages: 1 })
  })

  it('voucherType 필터 적용', async () => {
    setAuthenticated()
    mockPrisma.voucher.findMany.mockResolvedValue([])
    mockPrisma.voucher.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/accounting/vouchers?voucherType=RECEIPT'))

    const callArgs = mockPrisma.voucher.findMany.mock.calls[0][0]
    expect(callArgs.where.voucherType).toBe('RECEIPT')
  })

  it('status 필터 적용', async () => {
    setAuthenticated()
    mockPrisma.voucher.findMany.mockResolvedValue([])
    mockPrisma.voucher.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/accounting/vouchers?status=APPROVED'))

    const callArgs = mockPrisma.voucher.findMany.mock.calls[0][0]
    expect(callArgs.where.status).toBe('APPROVED')
  })

  it('날짜 범위 필터', async () => {
    setAuthenticated()
    mockPrisma.voucher.findMany.mockResolvedValue([])
    mockPrisma.voucher.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/accounting/vouchers?startDate=2024-01-01&endDate=2024-03-31'))

    const callArgs = mockPrisma.voucher.findMany.mock.calls[0][0]
    expect(callArgs.where.voucherDate.gte).toEqual(new Date('2024-01-01'))
    expect(callArgs.where.voucherDate.lte).toEqual(new Date('2024-03-31'))
  })

  it('검색 필터: 전표번호 또는 적요', async () => {
    setAuthenticated()
    mockPrisma.voucher.findMany.mockResolvedValue([])
    mockPrisma.voucher.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/accounting/vouchers?search=매출'))

    const callArgs = mockPrisma.voucher.findMany.mock.calls[0][0]
    expect(callArgs.where.OR).toHaveLength(2)
  })

  it('정렬: voucherDate desc', async () => {
    setAuthenticated()
    mockPrisma.voucher.findMany.mockResolvedValue([])
    mockPrisma.voucher.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/accounting/vouchers'))

    const callArgs = mockPrisma.voucher.findMany.mock.calls[0][0]
    expect(callArgs.orderBy).toEqual({ voucherDate: 'desc' })
  })

  it('DB 에러 → 500', async () => {
    setAuthenticated()
    mockPrisma.voucher.findMany.mockRejectedValue(new Error('timeout'))
    mockPrisma.voucher.count.mockRejectedValue(new Error('timeout'))

    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers'))
    expect(resp.status).toBe(500)
  })
})

// ─── POST Tests ───

describe('POST /api/v1/accounting/vouchers', () => {
  beforeEach(() => vi.clearAllMocks())

  const validBody = {
    voucherDate: '2024-06-15',
    voucherType: 'RECEIPT',
    description: '매출 전표',
    details: [
      { accountSubjectId: 'acc-1', debitAmount: 10000, creditAmount: 0, description: '현금' },
      { accountSubjectId: 'acc-2', debitAmount: 0, creditAmount: 10000, description: '매출' },
    ],
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    expect(resp.status).toBe(401)
  })

  it('유효성 검증 실패: voucherType 누락 → 400', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify({ voucherDate: '2024-01-01', details: [] }),
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('유효성 검증 실패: details 빈 배열 → 400', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          voucherDate: '2024-01-01',
          voucherType: 'RECEIPT',
          details: [],
        }),
      })
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('계정코드로 계정과목 해소', async () => {
    setAuthenticated()
    mockPrisma.accountSubject.findMany.mockResolvedValue([
      { id: 'acc-resolved-1', code: '1010' },
      { id: 'acc-resolved-2', code: '4010' },
    ])
    mockPrisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 'emp-1' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        voucher: {
          create: vi.fn().mockResolvedValue({
            id: 'v-1',
            voucherNo: 'VOU-001',
            details: [],
          }),
        },
      }
      return fn(tx)
    })
    mockGenerateDocNo.mockResolvedValue('VOU-2024-001')

    const bodyWithCodes = {
      voucherDate: '2024-06-15',
      voucherType: 'RECEIPT',
      details: [
        { accountCode: '1010', debitAmount: 5000, creditAmount: 0 },
        { accountCode: '4010', debitAmount: 0, creditAmount: 5000 },
      ],
    }

    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(bodyWithCodes),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('존재하지 않는 계정코드 → ACCOUNT_NOT_FOUND', async () => {
    setAuthenticated()
    mockPrisma.accountSubject.findMany.mockResolvedValue([]) // 없음

    const bodyWithBadCode = {
      voucherDate: '2024-06-15',
      voucherType: 'RECEIPT',
      details: [
        { accountCode: '9999', debitAmount: 1000, creditAmount: 0 },
        { accountCode: '8888', debitAmount: 0, creditAmount: 1000 },
      ],
    }

    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(bodyWithBadCode),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('차대변 불일치 → BALANCE_ERROR', async () => {
    setAuthenticated()
    const unbalanced = {
      voucherDate: '2024-06-15',
      voucherType: 'RECEIPT',
      details: [
        { accountSubjectId: 'acc-1', debitAmount: 10000, creditAmount: 0 },
        { accountSubjectId: 'acc-2', debitAmount: 0, creditAmount: 9000 }, // 1000원 차이
      ],
    }

    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(unbalanced),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('BALANCE_ERROR')
  })

  it('활성 회계연도 없으면 → NO_FISCAL_YEAR', async () => {
    setAuthenticated()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue(null) // 없음

    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('NO_FISCAL_YEAR')
  })

  it('사원 정보 미연결 → NO_EMPLOYEE', async () => {
    setAuthenticated()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: null })

    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('NO_EMPLOYEE')
  })

  it('정상 전표 생성', async () => {
    setAuthenticated()
    mockPrisma.fiscalYear.findFirst.mockResolvedValue({ id: 'fy-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 'emp-1' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        voucher: {
          create: vi.fn().mockResolvedValue({
            id: 'v-1',
            voucherNo: 'VOU-2024-001',
            voucherType: 'RECEIPT',
            totalDebit: 10000,
            totalCredit: 10000,
            details: [
              { accountSubject: { code: '1010', nameKo: '현금' } },
              { accountSubject: { code: '4010', nameKo: '매출' } },
            ],
          }),
        },
      }
      return fn(tx)
    })
    mockGenerateDocNo.mockResolvedValue('VOU-2024-001')

    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.voucherNo).toBe('VOU-2024-001')
  })

  it('잘못된 JSON → 400 INVALID_JSON', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/accounting/vouchers', {
        method: 'POST',
        body: '{invalid json}}}',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_JSON')
  })
})
