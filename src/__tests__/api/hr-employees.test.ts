/**
 * 난이도: 매우 어려움 (Very Hard)
 * HR 사원 API 라우트 핸들러 통합 테스트
 * GET: 인증, 필터링(부서/상태/사원유형/입사일), 검색, 민감정보 필터링, 페이지네이션
 * POST: 인증, 유효성검증, 중복사번, 자동 사용자계정 생성, 트랜잭션
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockAuth, mockPrisma, mockHasPermission } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    employee: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: { findUnique: vi.fn(), create: vi.fn() },
    role: { findFirst: vi.fn() },
    userRole: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockHasPermission: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}))

vi.mock('@/lib/cache', () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}))

import { GET, POST } from '@/app/api/v1/hr/employees/route'

function setAuthenticated(overrides?: Record<string, unknown>) {
  mockAuth.mockResolvedValue({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      roles: ['관리자'],
      permissions: [
        { module: 'hr', action: 'read' },
        { module: 'hr', action: 'create' },
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

describe('GET /api/v1/hr/employees', () => {
  beforeEach(() => vi.clearAllMocks())

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await GET(createReq('http://localhost/api/v1/hr/employees'))
    expect(resp.status).toBe(401)
  })

  it('권한 없는 사용자 → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-2', roles: [], permissions: [] },
    })
    const resp = await GET(createReq('http://localhost/api/v1/hr/employees'))
    expect(resp.status).toBe(403)
  })

  it('정상 조회 + 민감정보 표시 (HR 세부 권한 있을 때)', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true) // canViewSensitive
    const employees = [
      {
        id: '1',
        employeeNo: 'EMP-001',
        nameKo: '홍길동',
        phone: '010-1234-5678',
        bankAccount: '123-456',
        department: { id: 'd1', name: '개발팀' },
        position: { id: 'p1', name: '대리' },
      },
    ]
    mockPrisma.employee.findMany.mockResolvedValue(employees)
    mockPrisma.employee.count.mockResolvedValue(1)

    const resp = await GET(createReq('http://localhost/api/v1/hr/employees'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data[0].phone).toBe('010-1234-5678')
    expect(body.data[0].bankAccount).toBe('123-456')
  })

  it('민감정보 필터링 (HR 세부 권한 없을 때)', async () => {
    setAuthenticated()
    // requirePermissionCheck('hr','read') 에서 호출 → true, canViewSensitive('hr.employees','read') → false
    mockHasPermission.mockReturnValueOnce(true).mockReturnValueOnce(false)
    const employees = [
      {
        id: '1',
        employeeNo: 'EMP-001',
        nameKo: '홍길동',
        phone: '010-1234-5678',
        bankAccount: '123-456',
        bankName: '국민은행',
        birthDate: '1990-01-01',
        address: '서울시',
        gender: 'M',
        department: { id: 'd1', name: '개발팀' },
      },
    ]
    mockPrisma.employee.findMany.mockResolvedValue(employees)
    mockPrisma.employee.count.mockResolvedValue(1)

    const resp = await GET(createReq('http://localhost/api/v1/hr/employees'))
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.data[0].phone).toBeUndefined()
    expect(body.data[0].bankAccount).toBeUndefined()
    expect(body.data[0].bankName).toBeUndefined()
    expect(body.data[0].birthDate).toBeUndefined()
    expect(body.data[0].address).toBeUndefined()
    expect(body.data[0].gender).toBeUndefined()
    // 비민감 정보는 유지
    expect(body.data[0].nameKo).toBe('홍길동')
    expect(body.data[0].employeeNo).toBe('EMP-001')
  })

  it('검색 필터: 이름, 사번, 이메일', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findMany.mockResolvedValue([])
    mockPrisma.employee.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/hr/employees?search=홍길동'))

    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0]
    expect(callArgs.where.OR).toHaveLength(3)
  })

  it('departmentId 필터', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findMany.mockResolvedValue([])
    mockPrisma.employee.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/hr/employees?departmentId=dept-1'))

    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0]
    expect(callArgs.where.departmentId).toBe('dept-1')
  })

  it('status 필터', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findMany.mockResolvedValue([])
    mockPrisma.employee.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/hr/employees?status=ACTIVE'))

    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0]
    expect(callArgs.where.status).toBe('ACTIVE')
  })

  it('employeeType 필터', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findMany.mockResolvedValue([])
    mockPrisma.employee.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/hr/employees?employeeType=CONTRACT'))

    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0]
    expect(callArgs.where.employeeType).toBe('CONTRACT')
  })

  it('입사일 범위 필터', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findMany.mockResolvedValue([])
    mockPrisma.employee.count.mockResolvedValue(0)

    await GET(createReq('http://localhost/api/v1/hr/employees?joinDateFrom=2024-01-01&joinDateTo=2024-06-30'))

    const callArgs = mockPrisma.employee.findMany.mock.calls[0][0]
    expect(callArgs.where.joinDate.gte).toEqual(new Date('2024-01-01'))
    expect(callArgs.where.joinDate.lte).toEqual(new Date('2024-06-30'))
  })

  it('DB 에러 → 500', async () => {
    setAuthenticated()
    mockHasPermission.mockReturnValue(true)
    mockPrisma.employee.findMany.mockRejectedValue(new Error('Connection lost'))
    mockPrisma.employee.count.mockRejectedValue(new Error('Connection lost'))

    const resp = await GET(createReq('http://localhost/api/v1/hr/employees'))
    expect(resp.status).toBe(500)
  })
})

// ─── POST Tests ───

describe('POST /api/v1/hr/employees', () => {
  beforeEach(() => vi.clearAllMocks())

  const validBody = {
    employeeNo: 'EMP-2024-001',
    nameKo: '홍길동',
    departmentId: 'dept-1',
    positionId: 'pos-1',
    joinDate: '2024-06-15',
    employeeType: 'REGULAR',
    email: 'hong@example.com',
  }

  it('인증되지 않은 요청 → 401', async () => {
    mockAuth.mockResolvedValue(null)
    const resp = await POST(
      createReq('http://localhost/api/v1/hr/employees', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    expect(resp.status).toBe(401)
  })

  it('중복 사번 → 409', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 'existing', employeeNo: 'EMP-2024-001' })

    const resp = await POST(
      createReq('http://localhost/api/v1/hr/employees', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(409)
    expect(body.error.code).toBe('DUPLICATE_EMPLOYEE_NO')
  })

  it('정상 사원 생성 + 자동 사용자 계정', async () => {
    setAuthenticated()
    mockPrisma.employee.findUnique.mockResolvedValue(null)
    const created = {
      id: 'emp-new',
      employeeNo: 'EMP-2024-001',
      nameKo: '홍길동',
      department: { name: '개발팀' },
      position: { name: '사원' },
    }
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        employee: { create: vi.fn().mockResolvedValue(created) },
        user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'user-new' }) },
        role: { findFirst: vi.fn().mockResolvedValue({ id: 'role-1', name: '일반사용자' }) },
        userRole: { create: vi.fn() },
      }
      return fn(tx)
    })

    const resp = await POST(
      createReq('http://localhost/api/v1/hr/employees', {
        method: 'POST',
        body: JSON.stringify(validBody),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.employeeNo).toBe('EMP-2024-001')
  })

  it('유효성 검증 실패: 사번 빈 값 → 400', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/hr/employees', {
        method: 'POST',
        body: JSON.stringify({ employeeNo: '', nameKo: '' }),
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('잘못된 JSON → 400 INVALID_JSON', async () => {
    setAuthenticated()
    const resp = await POST(
      createReq('http://localhost/api/v1/hr/employees', {
        method: 'POST',
        body: 'invalid{{{',
        headers: { 'Content-Type': 'application/json' },
      })
    )
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_JSON')
  })
})
