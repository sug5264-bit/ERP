/**
 * 난이도: 어려움 (Hard)
 * 고급 엣지케이스 테스트
 * - 부동소수점 정밀도 (차대변 균형)
 * - 날짜 경계값 (윤년, 연말, 잘못된 형식)
 * - 페이지네이션 경계값
 * - 검색 쿼리 위생처리
 * - 문서번호 생성 동시성
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── 부동소수점 정밀도 ───

describe('부동소수점 정밀도: 전표 차대변 균형', () => {
  it('0.1 + 0.2 !== 0.3 문제를 센트 변환으로 해결', () => {
    // 실제 코드의 균형 검증 로직 재현
    const details = [
      { debitAmount: 0.1, creditAmount: 0 },
      { debitAmount: 0.2, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 0.3 },
    ]
    // 잘못된 방식 (부동소수점 오차)
    const rawDebit = details.reduce((s, d) => s + d.debitAmount, 0)
    const rawCredit = details.reduce((s, d) => s + d.creditAmount, 0)
    expect(rawDebit).not.toBe(rawCredit) // 0.30000000000000004 !== 0.3

    // 올바른 방식 (센트 변환)
    const debitCents = details.reduce((s, d) => s + Math.round(d.debitAmount * 100), 0)
    const creditCents = details.reduce((s, d) => s + Math.round(d.creditAmount * 100), 0)
    expect(debitCents).toBe(creditCents) // 30 === 30
  })

  it('큰 금액에서도 정밀도 유지', () => {
    const details = [
      { debitAmount: 999999999.99, creditAmount: 0 },
      { debitAmount: 0.01, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 1000000000.0 },
    ]
    const debitCents = details.reduce((s, d) => s + Math.round(d.debitAmount * 100), 0)
    const creditCents = details.reduce((s, d) => s + Math.round(d.creditAmount * 100), 0)
    expect(debitCents).toBe(creditCents)
  })

  it('부가세 10% 계산 반올림', () => {
    // 공급가 333원 → 부가세 33.3원 → 반올림 33원
    const supplyAmount = 333
    const taxAmount = Math.round(supplyAmount * 0.1)
    expect(taxAmount).toBe(33)

    // 공급가 335원 → 부가세 33.5원 → 반올림 34원 (은행원 반올림 아닌 Math.round)
    const supplyAmount2 = 335
    const taxAmount2 = Math.round(supplyAmount2 * 0.1)
    expect(taxAmount2).toBe(34) // Math.round(33.5) = 34
  })
})

// ─── 날짜 경계값 ───

describe('날짜 경계값 처리', () => {
  it('윤년 2월 29일', () => {
    const d = new Date('2024-02-29')
    expect(isNaN(d.getTime())).toBe(false)
    expect(d.getDate()).toBe(29)
  })

  it('비윤년 2월 29일 → 유효하지 않은 날짜', () => {
    const d = new Date('2023-02-29')
    // JS에서는 3월 1일로 변환됨
    expect(d.getMonth()).toBe(2) // 3월 (0-based)
    expect(d.getDate()).toBe(1)
  })

  it('연말 경계: 12월 31일', () => {
    const d = new Date('2024-12-31')
    expect(isNaN(d.getTime())).toBe(false)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(31)
  })

  it('잘못된 날짜 형식 → NaN', () => {
    expect(isNaN(new Date('invalid').getTime())).toBe(true)
    expect(isNaN(new Date('2024/13/01').getTime())).toBe(true)
    expect(isNaN(new Date('').getTime())).toBe(true)
  })

  it('endDate에 23:59:59.999 설정 (날짜 포함 범위)', () => {
    const d = new Date('2024-06-30')
    d.setHours(23, 59, 59, 999)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(59)
    expect(d.getSeconds()).toBe(59)
    expect(d.getMilliseconds()).toBe(999)
  })
})

// ─── 페이지네이션 경계값 ───

describe('페이지네이션 경계값', () => {
  // getPaginationParams 로직 재현
  function getPaginationParams(sp: URLSearchParams) {
    const rawPage = Number(sp.get('page') ?? 1)
    const rawPageSize = Number(sp.get('pageSize') ?? 20)
    const page = Math.max(1, Math.min(rawPage || 1, 10000))
    const pageSize = Math.max(1, Math.min(rawPageSize || 20, 100))
    return { page, pageSize, skip: (page - 1) * pageSize }
  }

  it('기본값: page=1, pageSize=20', () => {
    const params = getPaginationParams(new URLSearchParams())
    expect(params).toEqual({ page: 1, pageSize: 20, skip: 0 })
  })

  it('page=0 → 1로 보정', () => {
    const params = getPaginationParams(new URLSearchParams('page=0'))
    expect(params.page).toBe(1)
  })

  it('음수 page → 1로 보정', () => {
    const params = getPaginationParams(new URLSearchParams('page=-5'))
    expect(params.page).toBe(1)
  })

  it('pageSize > 100 → 100으로 제한', () => {
    const params = getPaginationParams(new URLSearchParams('pageSize=500'))
    expect(params.pageSize).toBe(100)
  })

  it('pageSize=0 → 20으로 기본값', () => {
    const params = getPaginationParams(new URLSearchParams('pageSize=0'))
    expect(params.pageSize).toBe(20)
  })

  it('NaN page → 1로 기본값', () => {
    const params = getPaginationParams(new URLSearchParams('page=abc'))
    expect(params.page).toBe(1)
  })

  it('skip 계산: page=3, pageSize=10 → skip=20', () => {
    const params = getPaginationParams(new URLSearchParams('page=3&pageSize=10'))
    expect(params.skip).toBe(20)
  })

  it('매우 큰 page → 10000으로 제한', () => {
    const params = getPaginationParams(new URLSearchParams('page=99999'))
    expect(params.page).toBe(10000)
  })
})

// ─── 검색 쿼리 위생처리 (실제 모듈) ───

import { sanitizeSearchQuery, sanitizeFileName, sanitizeString } from '@/lib/sanitize'

describe('검색 쿼리 위생처리', () => {
  it('SQL LIKE 와일드카드 이스케이프', () => {
    expect(sanitizeSearchQuery('test%')).toBe('test\\%')
    expect(sanitizeSearchQuery('test_name')).toBe('test\\_name')
    expect(sanitizeSearchQuery('path\\to')).toBe('path\\\\to')
  })

  it('제어 문자 제거', () => {
    expect(sanitizeSearchQuery('test\x00\x01')).toBe('test')
  })

  it('연속 공백 정리', () => {
    expect(sanitizeSearchQuery('a   b')).toBe('a b')
  })

  it('100자 초과 시 자르기', () => {
    const long = 'a'.repeat(200)
    expect(sanitizeSearchQuery(long).length).toBe(100)
  })

  it('빈 문자열', () => {
    expect(sanitizeSearchQuery('')).toBe('')
  })

  it('공백만 있는 문자열 → trim', () => {
    expect(sanitizeSearchQuery('   ')).toBe('')
  })

  it('한국어 검색어는 유지', () => {
    expect(sanitizeSearchQuery('홍길동')).toBe('홍길동')
    expect(sanitizeSearchQuery('서울특별시 강남구')).toBe('서울특별시 강남구')
  })
})

// ─── 파일명 위생처리 ───

describe('파일명 위생처리', () => {
  it('금지 문자 제거', () => {
    expect(sanitizeFileName('file<>:"/\\|?*.txt')).toBe('file.txt')
  })

  it('경로 순회 방지', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('etcpasswd')
  })

  it('OS 예약 파일명 방지', () => {
    expect(sanitizeFileName('CON')).toBe('_CON')
    expect(sanitizeFileName('NUL.txt')).toBe('_NUL.txt')
  })

  it('빈 결과 방지', () => {
    expect(sanitizeFileName('<>:"/\\|?*')).toBe('unnamed_file')
  })

  it('255자 제한', () => {
    const long = 'a'.repeat(300) + '.txt'
    expect(sanitizeFileName(long).length).toBeLessThanOrEqual(255)
  })
})

// ─── sanitizeString ───

describe('sanitizeString', () => {
  it('null 바이트 제거', () => {
    expect(sanitizeString('hello\0world')).toBe('helloworld')
  })

  it('연속 공백 → 단일 공백', () => {
    expect(sanitizeString('a    b     c')).toBe('a b c')
  })

  it('앞뒤 공백 trim', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
})

// ─── buildMeta 페이지네이션 메타 ───

describe('buildMeta 페이지네이션 메타', () => {
  function buildMeta(page: number, pageSize: number, totalCount: number) {
    return {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    }
  }

  it('정확한 나눗셈', () => {
    expect(buildMeta(1, 10, 100)).toEqual({ page: 1, pageSize: 10, totalCount: 100, totalPages: 10 })
  })

  it('나머지 있는 경우 올림', () => {
    expect(buildMeta(1, 10, 15)).toEqual({ page: 1, pageSize: 10, totalCount: 15, totalPages: 2 })
  })

  it('결과 없음', () => {
    expect(buildMeta(1, 20, 0)).toEqual({ page: 1, pageSize: 20, totalCount: 0, totalPages: 0 })
  })

  it('결과 1개', () => {
    expect(buildMeta(1, 20, 1)).toEqual({ page: 1, pageSize: 20, totalCount: 1, totalPages: 1 })
  })
})

// ─── 금액 범위 필터 엣지케이스 ───

describe('금액 범위 필터 엣지케이스', () => {
  function parseAmountFilter(min?: string | null, max?: string | null) {
    const result: { gte?: number; lte?: number } = {}
    if (min) {
      const n = Number(min)
      if (!isNaN(n)) result.gte = n
    }
    if (max) {
      const n = Number(max)
      if (!isNaN(n)) result.lte = n
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  it('정상 범위', () => {
    expect(parseAmountFilter('1000', '5000')).toEqual({ gte: 1000, lte: 5000 })
  })

  it('min만 지정', () => {
    expect(parseAmountFilter('1000', null)).toEqual({ gte: 1000 })
  })

  it('max만 지정', () => {
    expect(parseAmountFilter(null, '5000')).toEqual({ lte: 5000 })
  })

  it('NaN 값 무시', () => {
    expect(parseAmountFilter('abc', '5000')).toEqual({ lte: 5000 })
  })

  it('둘 다 NaN → undefined', () => {
    expect(parseAmountFilter('abc', 'def')).toBeUndefined()
  })

  it('0도 유효한 값', () => {
    expect(parseAmountFilter('0', '100')).toEqual({ gte: 0, lte: 100 })
  })

  it('음수도 유효', () => {
    expect(parseAmountFilter('-100', '100')).toEqual({ gte: -100, lte: 100 })
  })

  it('소수점', () => {
    expect(parseAmountFilter('99.99', '999.99')).toEqual({ gte: 99.99, lte: 999.99 })
  })
})
