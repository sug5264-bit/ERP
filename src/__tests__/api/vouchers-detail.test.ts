/**
 * 난이도: 매우 어려움 (Very Hard)
 * 전표 상세 API (GET/PUT/DELETE) 통합 테스트
 * PUT: 승인(action=approve), 일반 수정(details 변경)
 * DELETE: DRAFT 상태만 삭제 가능
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    voucher: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    voucherDetail: { deleteMany: vi.fn() },
    taxInvoice: { deleteMany: vi.fn() },
    user: { findUnique: vi.fn() },
    accountSubject: { findMany: vi.fn() },
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

import { GET, PUT, DELETE } from '@/app/api/v1/accounting/vouchers/[id]/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [
        { module: 'accounting', action: 'read' },
        { module: 'accounting', action: 'update' },
        { module: 'accounting', action: 'delete' },
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

const params = Promise.resolve({ id: 'voucher-1' })

// ─── GET Tests ───

describe('GET /api/v1/accounting/vouchers/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 전표 → 404', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('정상 조회: 전표 + 상세 + 관련 정보', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({
      id: 'voucher-1',
      voucherNo: 'VOU-001',
      status: 'DRAFT',
      details: [{ accountSubject: { code: '1010', nameKo: '현금' } }],
      createdBy: { nameKo: '홍길동' },
      approvedBy: null,
    })
    const resp = await GET(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.voucherNo).toBe('VOU-001')
  })
})

// ─── PUT Tests ───

describe('PUT /api/v1/accounting/vouchers/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params }
    )
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 전표 → 404', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue(null)
    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(404)
  })

  it('DRAFT가 아닌 전표 수정 불가 → 400', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'APPROVED' })
    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('승인 처리: 작성자 == 승인자 → 직무분리 위반', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 'emp-1' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        voucher: {
          findUnique: vi.fn().mockResolvedValue({ id: 'voucher-1', status: 'DRAFT', createdById: 'emp-1' }),
        },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params }
    )
    // handleApiError는 일반 Error를 400으로 반환
    expect(resp.status).toBe(400)
  })

  it('승인 처리: 정상 (다른 사원)', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: 'emp-2' }) // 다른 사원
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        voucher: {
          findUnique: vi.fn().mockResolvedValue({ id: 'voucher-1', status: 'DRAFT', createdById: 'emp-1' }),
          update: vi.fn().mockResolvedValue({ id: 'voucher-1', status: 'APPROVED', approvedById: 'emp-2' }),
        },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.status).toBe('APPROVED')
  })

  it('승인 처리: 사원 미연결 → 400', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })
    mockPrisma.user.findUnique.mockResolvedValue({ employeeId: null })

    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('NO_EMPLOYEE')
  })

  it('일반 수정: 차대변 균형 검증', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({
          details: [
            { accountSubjectId: 'acc-1', debitAmount: 10000, creditAmount: 0 },
            { accountSubjectId: 'acc-2', debitAmount: 0, creditAmount: 5000 }, // 불균형
          ],
        }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('BALANCE_ERROR')
  })

  it('일반 수정: 정상 업데이트', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })
    const updatedVoucher = {
      id: 'voucher-1',
      voucherNo: 'VOU-001',
      totalDebit: 10000,
      totalCredit: 10000,
      details: [
        { accountSubject: { code: '1010', nameKo: '현금' } },
        { accountSubject: { code: '4010', nameKo: '매출' } },
      ],
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        voucherDetail: { deleteMany: vi.fn() },
        voucher: { update: vi.fn().mockResolvedValue(updatedVoucher) },
      }
      return fn(tx)
    })

    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({
          details: [
            { accountSubjectId: 'acc-1', debitAmount: 10000, creditAmount: 0 },
            { accountSubjectId: 'acc-2', debitAmount: 0, creditAmount: 10000 },
          ],
        }),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.totalDebit).toBe(10000)
  })

  it('수정 데이터 없음 → NO_DATA', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })

    const resp = await PUT(
      createReq('http://localhost/api/v1/accounting/vouchers/v1', {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
      { params }
    )
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('NO_DATA')
  })
})

// ─── DELETE Tests ───

describe('DELETE /api/v1/accounting/vouchers/[id]', () => {
  beforeEach(() => vi.resetAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    expect(resp.status).toBe(401)
  })

  it('존재하지 않는 전표 → 404', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue(null)
    const resp = await DELETE(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(404)
  })

  it('DRAFT가 아닌 전표 삭제 불가 → 400', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'APPROVED' })
    const resp = await DELETE(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_STATUS')
  })

  it('정상 삭제: 트랜잭션으로 전표/상세/세금계산서 삭제', async () => {
    setAuthenticated()
    mockPrisma.voucher.findUnique.mockResolvedValue({ id: 'voucher-1', status: 'DRAFT' })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        taxInvoice: { deleteMany: vi.fn() },
        voucherDetail: { deleteMany: vi.fn() },
        voucher: { delete: vi.fn() },
      }
      return fn(tx)
    })

    const resp = await DELETE(createReq('http://localhost/api/v1/accounting/vouchers/v1'), { params })
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.deleted).toBe(true)
  })
})
