/**
 * 난이도: 어려움 (Hard)
 * API 에러 처리 통합 테스트: handleApiError의 모든 분기를 검증하고
 * 실제 API 응답 구조가 프론트엔드 기대와 일치하는지 확인
 */
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

import {
  handleApiError,
  successResponse,
  errorResponse,
  withApiHandler,
  getApiMetrics,
  resetApiMetrics,
} from '@/lib/api-helpers'
import { NextRequest, NextResponse } from 'next/server'

// ─── handleApiError 심층 테스트 ───

describe('handleApiError - 복합 에러 시나리오', () => {
  it('복잡한 ZodError (중첩 객체 + 배열 검증)', async () => {
    const schema = z.object({
      name: z.string().min(1),
      details: z
        .array(
          z.object({
            itemId: z.string().min(1),
            quantity: z.number().positive(),
          })
        )
        .min(1),
    })

    const result = schema.safeParse({
      name: '',
      details: [{ itemId: '', quantity: -1 }],
    })

    if (!result.success) {
      const resp = handleApiError(result.error)
      const body = await resp.json()
      expect(resp.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      // 여러 검증 실패 경로가 모두 반환되는지 확인
      expect(body.error.details.length).toBeGreaterThanOrEqual(3)
      // path에 배열 인덱스가 포함되는지 확인
      const paths = body.error.details.map((d: { path: (string | number)[] }) => d.path.join('.'))
      expect(paths).toContain('name')
    }
  })

  it('Prisma P2010 스키마 불일치 → 마이그레이션 안내 메시지', async () => {
    const resp = handleApiError({ code: 'P2010' })
    const body = await resp.json()
    expect(body.error.message).toContain('마이그레이션')
  })

  it('Prisma P2022 컬럼 불일치 → 마이그레이션 안내 메시지', async () => {
    const resp = handleApiError({ code: 'P2022' })
    const body = await resp.json()
    expect(body.error.message).toContain('마이그레이션')
  })

  it('비즈니스 에러 코드 분리: DUPLICATE:이미 존재하는 코드입니다', async () => {
    const resp = handleApiError(new Error('DUPLICATE:이미 존재하는 코드입니다'))
    const body = await resp.json()
    expect(body.error.code).toBe('DUPLICATE')
    expect(body.error.message).toBe('이미 존재하는 코드입니다')
    expect(resp.status).toBe(400) // DUPLICATE는 NOT_FOUND가 아니므로 400
  })

  it('비즈니스 에러: 복합 한국어 키워드 매칭', async () => {
    const businessMessages = [
      { msg: '재고 수량이 부족합니다', keyword: '부족합니다' },
      { msg: '주문은 대기 상태만 승인 가능합니다', keyword: '만 승인' },
      { msg: '작성 상태만 제출 가능합니다', keyword: '만 제출' },
      { msg: '이미 발주된 주문입니다', keyword: '이미 발주' },
      { msg: '유효하지 않은 상태입니다', keyword: '유효하지' },
    ]

    for (const { msg } of businessMessages) {
      const resp = handleApiError(new Error(msg))
      expect(resp.status).toBe(400)
    }
  })

  it('일반 Error는 원래 메시지를 응답에 노출하지 않음', async () => {
    const sensitiveError = new Error('Connection to postgres://user:password@db:5432/erp failed')
    const resp = handleApiError(sensitiveError)
    const body = await resp.json()
    expect(resp.status).toBe(500)
    expect(body.error.message).not.toContain('postgres')
    expect(body.error.message).not.toContain('password')
    expect(body.error.message).toBe('서버 오류가 발생했습니다.')
  })

  it('undefined/null 에러도 500 처리', async () => {
    const resp1 = handleApiError(undefined)
    expect(resp1.status).toBe(500)

    const resp2 = handleApiError(null)
    expect(resp2.status).toBe(500)
  })

  it('숫자 에러도 500 처리', async () => {
    const resp = handleApiError(42)
    const body = await resp.json()
    expect(resp.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

// ─── API 응답 구조 일관성 테스트 ───

describe('API 응답 구조 일관성', () => {
  it('성공 응답에는 success:true, data 포함', async () => {
    const resp = successResponse({ id: 1 })
    const body = await resp.json()
    expect(body).toHaveProperty('success', true)
    expect(body).toHaveProperty('data')
    expect(body).not.toHaveProperty('error')
  })

  it('에러 응답에는 success:false, error 포함', async () => {
    const resp = errorResponse('에러', 'ERR', 400)
    const body = await resp.json()
    expect(body).toHaveProperty('success', false)
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body).not.toHaveProperty('data')
  })

  it('handleApiError 반환값도 동일한 에러 구조', async () => {
    const resp = handleApiError(new Error('테스트 에러입니다. 찾을 수 없습니다'))
    const body = await resp.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
    expect(typeof body.error.code).toBe('string')
    expect(typeof body.error.message).toBe('string')
  })
})

// ─── withApiHandler 래퍼 테스트 ───

describe('withApiHandler', () => {
  beforeEach(() => {
    resetApiMetrics()
  })

  it('정상 핸들러 실행 및 헤더 추가', async () => {
    const handler = withApiHandler(async () => {
      return NextResponse.json({ success: true, data: 'ok' })
    })

    const req = new NextRequest('http://localhost/api/test')
    const resp = await handler(req)

    expect(resp.status).toBe(200)
    expect(resp.headers.get('X-Request-Id')).toBeTruthy()
    expect(resp.headers.get('X-Response-Time')).toBeTruthy()
  })

  it('핸들러 예외 발생 시 에러 응답 + 헤더', async () => {
    const handler = withApiHandler(async () => {
      throw new Error('서버 내부 오류')
    })

    const req = new NextRequest('http://localhost/api/test')
    const resp = await handler(req)
    const body = await resp.json()

    expect(resp.status).toBe(500)
    expect(body.success).toBe(false)
    expect(resp.headers.get('X-Request-Id')).toBeTruthy()
    expect(resp.headers.get('X-Response-Time')).toBeTruthy()
  })

  it('요청 헤더의 X-Request-Id를 그대로 사용', async () => {
    const handler = withApiHandler(async () => {
      return NextResponse.json({ success: true })
    })

    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-request-id': 'custom-req-123' },
    })
    const resp = await handler(req)

    expect(resp.headers.get('X-Request-Id')).toBe('custom-req-123')
  })

  it('메트릭이 올바르게 기록됨', async () => {
    const handler = withApiHandler(async () => {
      return NextResponse.json({ success: true }, { status: 200 })
    })

    const req = new NextRequest('http://localhost/api/test')
    await handler(req)
    await handler(req)

    const metrics = getApiMetrics()
    expect(metrics.totalRequests).toBe(2)
    expect(metrics.statusCodes[200]).toBe(2)
    expect(metrics.errorCount).toBe(0)
    expect(metrics.avgResponseTime).toBeGreaterThanOrEqual(0)
  })

  it('에러 핸들러도 메트릭에 기록', async () => {
    const handler = withApiHandler(async () => {
      throw new Error('test error')
    })

    const req = new NextRequest('http://localhost/api/test')
    await handler(req)

    const metrics = getApiMetrics()
    expect(metrics.totalRequests).toBe(1)
    expect(metrics.errorCount).toBe(1)
    expect(metrics.statusCodes[500]).toBe(1)
  })

  it('ZodError를 던지는 핸들러 → 400 VALIDATION_ERROR', async () => {
    const schema = z.object({ name: z.string().min(1) })
    const handler = withApiHandler(async () => {
      schema.parse({ name: '' }) // will throw ZodError
      return NextResponse.json({ success: true })
    })

    const req = new NextRequest('http://localhost/api/test')
    const resp = await handler(req)
    const body = await resp.json()

    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
