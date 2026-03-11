/**
 * 난이도: 매우 어려움 (Very Hard)
 * 대량 임포트 API 테스트 (품목, 거래처, 사원)
 * - 빈 데이터 / 초과 데이터 검증
 * - 행별 유효성 검증 (필수필드, 형식, 중복)
 * - 자동 코드 생성
 * - 부분 성공/실패 결과 반환
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    item: { findMany: vi.fn(), create: vi.fn() },
    itemCategory: { findMany: vi.fn() },
    partner: { findMany: vi.fn(), create: vi.fn() },
    employee: { findMany: vi.fn(), create: vi.fn() },
    department: { findMany: vi.fn() },
    position: { findMany: vi.fn() },
    documentSequence: { upsert: vi.fn() },
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

import { POST as ImportItems } from '@/app/api/v1/inventory/items/import/route'
import { POST as ImportPartners } from '@/app/api/v1/partners/import/route'
import { POST as ImportEmployees } from '@/app/api/v1/hr/employees/import/route'

function setAuthenticated(module: string) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      roles: ['관리자'],
      permissions: [{ module, action: 'create' }],
      employeeId: 'emp-1',
      accountType: 'INTERNAL',
    },
  })
}

function createReq(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost/api/v1/import'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── 품목 임포트 ───

describe('POST /api/v1/inventory/items/import', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma.item.findMany.mockResolvedValue([])
    mockPrisma.itemCategory.findMany.mockResolvedValue([])
  })

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await ImportItems(createReq({ rows: [{ itemName: 'test' }] }))
    expect(resp.status).toBe(401)
  })

  it('빈 데이터 → EMPTY_DATA', async () => {
    setAuthenticated('inventory')
    const resp = await ImportItems(createReq({ rows: [] }))
    const body = await resp.json()
    expect(body.error.code).toBe('EMPTY_DATA')
  })

  it('500건 초과 → TOO_LARGE', async () => {
    setAuthenticated('inventory')
    const rows = Array.from({ length: 501 }, (_, i) => ({ itemName: `item-${i}` }))
    const resp = await ImportItems(createReq({ rows }))
    const body = await resp.json()
    expect(resp.status).toBe(413)
    expect(body.error.code).toBe('TOO_LARGE')
  })

  it('품목명 필수 누락 → 행 에러', async () => {
    setAuthenticated('inventory')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportItems(createReq({ rows: [{ itemCode: 'TEST-001' }] }))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('품목명')
  })

  it('잘못된 품목코드 형식 → 행 에러', async () => {
    setAuthenticated('inventory')
    const resp = await ImportItems(createReq({ rows: [{ itemCode: '한글코드!!!', itemName: '테스트품목' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('영문, 숫자, 하이픈')
  })

  it('중복 품목코드 → 행 에러', async () => {
    setAuthenticated('inventory')
    mockPrisma.item.findMany.mockResolvedValueOnce([{ itemCode: 'DUP-001' }]) // existing codes
    const resp = await ImportItems(createReq({ rows: [{ itemCode: 'DUP-001', itemName: '중복품목' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('이미 존재')
  })

  it('잘못된 표준단가 → 행 에러', async () => {
    setAuthenticated('inventory')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportItems(createReq({ rows: [{ itemName: '테스트', standardPrice: -1000 }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('0 이상')
  })

  it('유효하지 않은 품목유형 → 행 에러', async () => {
    setAuthenticated('inventory')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportItems(createReq({ rows: [{ itemName: '테스트', itemType: 'INVALID' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
  })

  it('정상 임포트: 자동 코드 생성', async () => {
    setAuthenticated('inventory')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    mockPrisma.item.create.mockResolvedValue({ id: 'item-1' })
    const resp = await ImportItems(createReq({ rows: [{ itemName: '신규품목', standardPrice: 1000, unit: 'EA' }] }))
    const body = await resp.json()
    expect(resp.status).toBe(200)
    expect(body.data.success).toBe(1)
    expect(body.data.failed).toBe(0)
    expect(body.data.autoCreated).toHaveLength(1)
  })

  it('한국어 품목유형 매핑 (상품→GOODS)', async () => {
    setAuthenticated('inventory')
    mockPrisma.item.create.mockResolvedValue({ id: 'item-1' })
    const resp = await ImportItems(
      createReq({ rows: [{ itemCode: 'ITEM-001', itemName: '상품테스트', itemType: '상품' }] })
    )
    const body = await resp.json()
    expect(body.data.success).toBe(1)
    const createCall = mockPrisma.item.create.mock.calls[0][0]
    expect(createCall.data.itemType).toBe('GOODS')
  })

  it('부분 성공: 일부 행만 성공', async () => {
    setAuthenticated('inventory')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    mockPrisma.item.create.mockResolvedValue({ id: 'item-1' })
    const resp = await ImportItems(
      createReq({
        rows: [
          { itemCode: 'OK-001', itemName: '성공품목' },
          { itemCode: '!!!', itemName: '실패품목' }, // 잘못된 코드
          { itemCode: 'OK-002', itemName: '성공품목2' },
        ],
      })
    )
    const body = await resp.json()
    expect(body.data.success).toBe(2)
    expect(body.data.failed).toBe(1)
    expect(body.data.errors).toHaveLength(1)
    expect(body.data.errors[0].row).toBe(3) // 2번째 행 = Excel 3행
  })
})

// ─── 거래처 임포트 ───

describe('POST /api/v1/partners/import', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma.partner.findMany.mockResolvedValue([])
  })

  it('빈 데이터 → EMPTY_DATA', async () => {
    setAuthenticated('sales')
    const resp = await ImportPartners(createReq({ rows: [] }))
    const body = await resp.json()
    expect(body.error.code).toBe('EMPTY_DATA')
  })

  it('500건 초과 → TOO_LARGE', async () => {
    setAuthenticated('sales')
    const rows = Array.from({ length: 501 }, (_, i) => ({ partnerName: `p-${i}` }))
    const resp = await ImportPartners(createReq({ rows }))
    expect(resp.status).toBe(413)
  })

  it('거래처명 필수 누락', async () => {
    setAuthenticated('sales')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportPartners(createReq({ rows: [{ partnerCode: 'PTN-001' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('거래처명')
  })

  it('잘못된 이메일 형식', async () => {
    setAuthenticated('sales')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportPartners(createReq({ rows: [{ partnerName: '테스트거래처', email: 'invalid-email' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('이메일')
  })

  it('한국어 거래처유형 매핑 (매출→SALES)', async () => {
    setAuthenticated('sales')
    mockPrisma.partner.create.mockResolvedValue({ id: 'p-1' })
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportPartners(createReq({ rows: [{ partnerName: '테스트', partnerType: '매출' }] }))
    const body = await resp.json()
    expect(body.data.success).toBe(1)
    const createCall = mockPrisma.partner.create.mock.calls[0][0]
    expect(createCall.data.partnerType).toBe('SALES')
  })

  it('정상 임포트: 자동 코드 생성', async () => {
    setAuthenticated('sales')
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    mockPrisma.partner.create.mockResolvedValue({ id: 'p-1' })
    const resp = await ImportPartners(createReq({ rows: [{ partnerName: '신규거래처', bizNo: '123-45-67890' }] }))
    const body = await resp.json()
    expect(body.data.success).toBe(1)
    expect(body.data.autoCreated).toHaveLength(1)
  })

  it('중복 거래처명 → 에러', async () => {
    setAuthenticated('sales')
    mockPrisma.partner.findMany
      .mockResolvedValueOnce([]) // existingPartners (by code)
      .mockResolvedValueOnce([{ partnerName: '기존거래처', partnerCode: 'PTN-001' }]) // existingNames
    mockPrisma.documentSequence.upsert.mockResolvedValue({ lastSeq: 1 })
    const resp = await ImportPartners(createReq({ rows: [{ partnerName: '기존거래처' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('이미 존재')
  })
})

// ─── 사원 임포트 ───

describe('POST /api/v1/hr/employees/import', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPrisma.department.findMany.mockResolvedValue([{ id: 'dept-1', name: '개발팀' }])
    mockPrisma.position.findMany.mockResolvedValue([{ id: 'pos-1', name: '사원' }])
    mockPrisma.employee.findMany.mockResolvedValue([])
  })

  it('빈 데이터 → EMPTY_DATA', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(createReq({ rows: [] }))
    const body = await resp.json()
    expect(body.error.code).toBe('EMPTY_DATA')
  })

  it('필수 필드 누락 (사번, 이름)', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(createReq({ rows: [{ department: '개발팀' }] }))
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('사번과 이름')
  })

  it('잘못된 사번 형식', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(
      createReq({ rows: [{ employeeNo: '한글사번!!!', nameKo: '홍길동', department: '개발팀', position: '사원' }] })
    )
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('영문, 숫자, 하이픈')
  })

  it('중복 사번 → 에러', async () => {
    setAuthenticated('hr')
    mockPrisma.employee.findMany.mockResolvedValue([{ employeeNo: 'EMP-001' }])
    const resp = await ImportEmployees(
      createReq({ rows: [{ employeeNo: 'EMP-001', nameKo: '홍길동', department: '개발팀', position: '사원' }] })
    )
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('이미 존재')
  })

  it('존재하지 않는 부서 → 에러', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(
      createReq({
        rows: [{ employeeNo: 'EMP-NEW', nameKo: '홍길동', department: '없는부서', position: '사원' }],
      })
    )
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('부서')
  })

  it('존재하지 않는 직급 → 에러', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(
      createReq({
        rows: [{ employeeNo: 'EMP-NEW', nameKo: '홍길동', department: '개발팀', position: '없는직급' }],
      })
    )
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('직급')
  })

  it('잘못된 이메일 형식', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(
      createReq({
        rows: [{ employeeNo: 'EMP-NEW', nameKo: '홍길동', department: '개발팀', position: '사원', email: 'not-email' }],
      })
    )
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
  })

  it('잘못된 입사일 → 에러', async () => {
    setAuthenticated('hr')
    const resp = await ImportEmployees(
      createReq({
        rows: [
          { employeeNo: 'EMP-NEW', nameKo: '홍길동', department: '개발팀', position: '사원', joinDate: 'bad-date' },
        ],
      })
    )
    const body = await resp.json()
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('입사일')
  })

  it('한국어 고용유형 매핑 (정규직→REGULAR)', async () => {
    setAuthenticated('hr')
    mockPrisma.employee.create.mockResolvedValue({ id: 'emp-new' })
    const resp = await ImportEmployees(
      createReq({
        rows: [
          { employeeNo: 'EMP-NEW', nameKo: '홍길동', department: '개발팀', position: '사원', employeeType: '정규직' },
        ],
      })
    )
    const body = await resp.json()
    expect(body.data.success).toBe(1)
    const createCall = mockPrisma.employee.create.mock.calls[0][0]
    expect(createCall.data.employeeType).toBe('REGULAR')
  })

  it('정상 임포트: 여러 행', async () => {
    setAuthenticated('hr')
    mockPrisma.employee.create.mockResolvedValue({ id: 'emp-new' })
    const resp = await ImportEmployees(
      createReq({
        rows: [
          { employeeNo: 'EMP-001', nameKo: '홍길동', department: '개발팀', position: '사원' },
          { employeeNo: 'EMP-002', nameKo: '김철수', department: '개발팀', position: '사원' },
        ],
      })
    )
    const body = await resp.json()
    expect(body.data.success).toBe(2)
    expect(body.data.failed).toBe(0)
  })

  it('배치 내 중복 사번 방지', async () => {
    setAuthenticated('hr')
    mockPrisma.employee.create.mockResolvedValue({ id: 'emp-new' })
    const resp = await ImportEmployees(
      createReq({
        rows: [
          { employeeNo: 'EMP-DUP', nameKo: '홍길동', department: '개발팀', position: '사원' },
          { employeeNo: 'EMP-DUP', nameKo: '김철수', department: '개발팀', position: '사원' },
        ],
      })
    )
    const body = await resp.json()
    expect(body.data.success).toBe(1)
    expect(body.data.failed).toBe(1)
    expect(body.data.errors[0].message).toContain('이미 존재')
  })
})
