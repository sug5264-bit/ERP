import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}))

import {
  successResponse,
  errorResponse,
  handleApiError,
  generateRequestId,
  getRequestId,
  getApiMetrics,
  resetApiMetrics,
} from '@/lib/api-helpers'

describe('successResponse', () => {
  it('성공 응답 생성', async () => {
    const resp = successResponse({ id: 1, name: 'test' })
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual({ id: 1, name: 'test' })
    expect(resp.status).toBe(200)
  })

  it('메타 데이터 포함', async () => {
    const meta = { page: 1, pageSize: 20, totalCount: 100, totalPages: 5 }
    const resp = successResponse([], meta)
    const body = await resp.json()
    expect(body.meta).toEqual(meta)
  })

  it('캐시 헤더 설정', () => {
    const resp = successResponse({}, undefined, { cache: 'private, max-age=300' })
    expect(resp.headers.get('Cache-Control')).toBe('private, max-age=300')
  })

  it('null 데이터 허용', async () => {
    const resp = successResponse(null)
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(body.data).toBeNull()
  })
})

describe('errorResponse', () => {
  it('에러 응답 생성', async () => {
    const resp = errorResponse('테스트 에러', 'TEST_ERROR', 400)
    const body = await resp.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('TEST_ERROR')
    expect(body.error.message).toBe('테스트 에러')
    expect(resp.status).toBe(400)
  })

  it('기본값 사용', async () => {
    const resp = errorResponse('에러 메시지')
    const body = await resp.json()
    expect(body.error.code).toBe('ERROR')
    expect(resp.status).toBe(400)
  })

  it('상세 정보 포함', async () => {
    const details = [{ path: ['field'], message: 'required' }]
    const resp = errorResponse('에러', 'ERR', 400, details)
    const body = await resp.json()
    expect(body.error.details).toEqual(details)
  })

  it('다양한 상태 코드', () => {
    expect(errorResponse('msg', 'ERR', 401).status).toBe(401)
    expect(errorResponse('msg', 'ERR', 403).status).toBe(403)
    expect(errorResponse('msg', 'ERR', 404).status).toBe(404)
    expect(errorResponse('msg', 'ERR', 409).status).toBe(409)
    expect(errorResponse('msg', 'ERR', 500).status).toBe(500)
  })
})

describe('handleApiError', () => {
  it('ZodError → VALIDATION_ERROR (400)', async () => {
    const schema = z.object({ name: z.string().min(1) })
    const result = schema.safeParse({ name: '' })
    if (!result.success) {
      const resp = handleApiError(result.error)
      const body = await resp.json()
      expect(resp.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.details).toBeDefined()
      expect(Array.isArray(body.error.details)).toBe(true)
    }
  })

  it('ZodError 세부 정보에 path/message만 포함', async () => {
    const schema = z.object({ email: z.string().email() })
    const result = schema.safeParse({ email: 'invalid' })
    if (!result.success) {
      const resp = handleApiError(result.error)
      const body = await resp.json()
      for (const detail of body.error.details) {
        expect(detail).toHaveProperty('path')
        expect(detail).toHaveProperty('message')
        expect(Object.keys(detail)).toEqual(['path', 'message'])
      }
    }
  })

  it('SyntaxError (잘못된 JSON) → INVALID_JSON (400)', async () => {
    const resp = handleApiError(new SyntaxError('Unexpected token < in JSON at position 0'))
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('INVALID_JSON')
  })

  it('Prisma P2002 중복 에러', async () => {
    const prismaError = { code: 'P2002', meta: { field_name: 'code' } }
    const resp = handleApiError(prismaError)
    const body = await resp.json()
    expect(resp.status).toBe(400)
    expect(body.error.code).toBe('DATABASE_ERROR')
    expect(body.error.message).toContain('이미 존재')
  })

  it('Prisma P2003 참조 에러', async () => {
    const resp = handleApiError({ code: 'P2003', meta: {} })
    const body = await resp.json()
    expect(body.error.message).toContain('참조')
  })

  it('Prisma P2025 데이터 미발견', async () => {
    const resp = handleApiError({ code: 'P2025' })
    const body = await resp.json()
    expect(body.error.message).toContain('찾을 수 없습니다')
  })

  it('Prisma 알 수 없는 코드 → 일반 DB 에러 메시지', async () => {
    const resp = handleApiError({ code: 'P9999' })
    const body = await resp.json()
    expect(body.error.code).toBe('DATABASE_ERROR')
    expect(body.error.message).toContain('오류')
  })

  it('비즈니스 에러 (한국어 키워드 포함)', async () => {
    const messages = [
      '재고가 부족합니다',
      '입력값이 올바르지 않습니다',
      '필수 항목이 필요합니다',
      '데이터를 찾을 수 없습니다',
      '한도를 초과',
      '수량은 0보다 커야 합니다',
      '삭제할 수 없습니다',
      '이미 존재하는 코드',
      '값이 일치하지 않습니다',
      '이미 처리된 건',
      '이미 완료된 건',
      '이미 취소된 건',
      '이미 발주된 건',
      '필수 입력',
      '이메일을 입력하세요',
      '목록에 포함되지 않습니다',
      '유효하지 않은 값',
      '올바른 형식이 아닙니다',
      '항목이 누락되었습니다',
      '30일 이내',
      '정수여야 합니다',
      '대기 상태만 승인 가능',
      '작성 상태만 제출 가능',
      '상태가 변경되었습니다',
      '잠시 후 다시 시도',
    ]

    for (const msg of messages) {
      const resp = handleApiError(new Error(msg))
      expect(resp.status).toBeLessThan(500)
    }
  })

  it('비즈니스 에러 코드:메시지 형식 분리', async () => {
    const resp = handleApiError(new Error('NOT_FOUND:해당 주문을 찾을 수 없습니다'))
    const body = await resp.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBe('해당 주문을 찾을 수 없습니다')
    expect(resp.status).toBe(404)
  })

  it('NOT_FOUND 코드는 404 반환', async () => {
    const resp = handleApiError(new Error('NOT_FOUND:데이터 없습니다'))
    expect(resp.status).toBe(404)
  })

  it('일반 Error는 500 (정보 노출 방지)', async () => {
    const resp = handleApiError(new Error('SQL injection attempt'))
    const body = await resp.json()
    expect(resp.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).not.toContain('SQL')
  })

  it('문자열 에러도 500', async () => {
    const resp = handleApiError('string error')
    const body = await resp.json()
    expect(resp.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('generateRequestId', () => {
  it('고유한 ID 생성', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()))
    expect(ids.size).toBe(100)
  })

  it('문자열 형식', () => {
    const id = generateRequestId()
    expect(typeof id).toBe('string')
    expect(id.split('-').length).toBe(3)
  })
})

describe('getRequestId', () => {
  it('헤더에서 추출', () => {
    const req = { headers: { get: (key: string) => (key === 'x-request-id' ? 'custom-id' : null) } } as any
    expect(getRequestId(req)).toBe('custom-id')
  })

  it('헤더 없으면 자동 생성', () => {
    const req = { headers: { get: () => null } } as any
    const id = getRequestId(req)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('요청 없으면 자동 생성', () => {
    const id = getRequestId()
    expect(typeof id).toBe('string')
  })
})

describe('apiMetrics', () => {
  beforeEach(() => {
    resetApiMetrics()
  })

  it('초기 메트릭', () => {
    const metrics = getApiMetrics()
    expect(metrics.totalRequests).toBe(0)
    expect(metrics.errorCount).toBe(0)
    expect(metrics.avgResponseTime).toBe(0)
    expect(metrics.maxResponseTime).toBe(0)
    expect(metrics.statusCodes).toEqual({})
    expect(metrics.uptimeMinutes).toBeGreaterThanOrEqual(0)
  })

  it('리셋 동작', () => {
    resetApiMetrics()
    const metrics = getApiMetrics()
    expect(metrics.totalRequests).toBe(0)
  })

  it('반환된 메트릭은 원본의 복사본', () => {
    const metrics = getApiMetrics()
    metrics.totalRequests = 999
    expect(getApiMetrics().totalRequests).toBe(0)
  })

  it('statusCodes도 복사본', () => {
    const metrics = getApiMetrics()
    metrics.statusCodes[200] = 999
    expect(getApiMetrics().statusCodes[200]).toBeUndefined()
  })
})
