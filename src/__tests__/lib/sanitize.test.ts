import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeFileName,
  sanitizeObject,
  validatePaginationParams,
} from '@/lib/sanitize'

describe('escapeHtml', () => {
  it('HTML 특수문자를 이스케이프', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('일반 텍스트는 변경 없음', () => {
    expect(escapeHtml('안녕하세요')).toBe('안녕하세요')
  })

  it('작은따옴표 이스케이프', () => {
    expect(escapeHtml("test'value")).toBe('test&#x27;value')
  })

  it('앰퍼샌드 이스케이프', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b')
  })
})

describe('sanitizeString', () => {
  it('null 바이트 제거', () => {
    expect(sanitizeString('hello\0world')).toBe('helloworld')
  })

  it('제어 문자 제거', () => {
    expect(sanitizeString('abc\x01\x02def')).toBe('abcdef')
  })

  it('연속 공백 정리', () => {
    expect(sanitizeString('hello    world')).toBe('hello world')
  })

  it('앞뒤 공백 제거', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
})

describe('sanitizeSearchQuery', () => {
  it('SQL 와일드카드 이스케이프', () => {
    expect(sanitizeSearchQuery('test%value')).toBe('test\\%value')
    expect(sanitizeSearchQuery('test_value')).toBe('test\\_value')
  })

  it('100자 제한', () => {
    const longQuery = 'a'.repeat(200)
    expect(sanitizeSearchQuery(longQuery).length).toBe(100)
  })
})

describe('sanitizeFileName', () => {
  it('경로 순회 방지', () => {
    expect(sanitizeFileName('../../../etc/passwd')).toBe('etcpasswd')
  })

  it('금지 문자 제거', () => {
    expect(sanitizeFileName('file<name>.txt')).toBe('filename.txt')
  })

  it('OS 예약 파일명 방지', () => {
    expect(sanitizeFileName('CON')).toBe('_CON')
    expect(sanitizeFileName('NUL')).toBe('_NUL')
  })

  it('255자 제한', () => {
    const longName = 'a'.repeat(300) + '.txt'
    expect(sanitizeFileName(longName).length).toBeLessThanOrEqual(255)
  })
})

describe('sanitizeObject', () => {
  it('중첩 객체의 문자열 살균', () => {
    const input = {
      name: 'hello\0world',
      nested: {
        value: 'test\x01data',
      },
      list: ['item\0one', 'item two'],
    }
    const result = sanitizeObject(input)
    expect(result.name).toBe('helloworld')
    expect(result.nested.value).toBe('testdata')
    expect(result.list[0]).toBe('itemone')
  })

  it('비문자열 값은 변경 없음', () => {
    const input = { count: 42, active: true, data: null }
    const result = sanitizeObject(input)
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
    expect(result.data).toBe(null)
  })
})

describe('validatePaginationParams', () => {
  it('기본값 반환', () => {
    expect(validatePaginationParams(undefined, undefined)).toEqual({ page: 1, pageSize: 20 })
  })

  it('최소값 보장', () => {
    // 0은 NaN이 아니라 falsy → Number(0) = 0 → fallback to default 20
    expect(validatePaginationParams(-1, 0)).toEqual({ page: 1, pageSize: 20 })
  })

  it('최대값 제한', () => {
    expect(validatePaginationParams(99999, 999)).toEqual({ page: 10000, pageSize: 100 })
  })

  it('유효한 값은 그대로 반환', () => {
    expect(validatePaginationParams(5, 50)).toEqual({ page: 5, pageSize: 50 })
  })
})
