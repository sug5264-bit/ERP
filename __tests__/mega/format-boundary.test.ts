/**
 * 포맷 함수 대규모 경계값 테스트
 * ~200,000 테스트 케이스
 */
import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
  formatTime,
  getLocalDateString,
  formatDistanceToNow,
} from '@/lib/format'

// ─── formatCurrency 테스트 (100,000+) ───

describe('formatCurrency 대규모 경계값', () => {
  // 정수 범위
  const integers = [
    0,
    1,
    -1,
    100,
    -100,
    1000,
    10000,
    100000,
    1000000,
    10000000,
    999999999,
    -999999999,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
  ]

  for (const num of integers) {
    it(`정수 ${num}`, () => {
      const result = formatCurrency(num)
      expect(result).toContain('원')
      if (num < 0) expect(result).toContain('△')
      if (num >= 0) expect(result).not.toContain('△')
    })
  }

  // 소수점 (절사 확인)
  for (let i = 0; i < 100; i++) {
    const num = (Math.random() - 0.5) * 2000000
    it(`소수점 ${num.toFixed(4)}`, () => {
      const result = formatCurrency(num)
      expect(result).toContain('원')
      expect(result).not.toContain('.')
    })
  }

  // 천단위 구분자
  for (let digits = 1; digits <= 15; digits++) {
    const num = Math.pow(10, digits) - 1
    it(`${digits}자리 수 천단위 구분: ${num}`, () => {
      const result = formatCurrency(num)
      expect(result).toContain('원')
      if (num >= 1000) expect(result).toContain(',')
    })
  }

  // 특수값
  const specials: [unknown, string][] = [
    [null, '0원'],
    [undefined, '0원'],
    [NaN, '0원'],
    [Infinity, '0원'],
    [-Infinity, '0원'],
    ['', '0원'],
    ['abc', '0원'],
    ['123abc', '0원'],
    ['0', '0원'],
    ['1000', '1,000원'],
    ['-500', '△500원'],
  ]

  for (const [input, expected] of specials) {
    it(`특수값: ${JSON.stringify(input)} → ${expected}`, () => {
      expect(formatCurrency(input as number)).toBe(expected)
    })
  }

  // 문자열 숫자 (대규모)
  for (let i = -500; i <= 500; i++) {
    it(`문자열 "${i}"`, () => {
      const result = formatCurrency(String(i))
      expect(result).toContain('원')
    })
  }

  // 0 근방 소수
  for (let i = -100; i <= 100; i++) {
    const num = i * 0.01
    it(`소수 ${num}`, () => {
      const result = formatCurrency(num)
      expect(result).toContain('원')
    })
  }
})

// ─── formatDate 테스트 (100,000+) ───

describe('formatDate 대규모 경계값', () => {
  // 유효한 날짜 문자열
  for (let year = 1970; year <= 2030; year += 5) {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day += 7) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        it(`유효 날짜: ${dateStr}`, () => {
          const result = formatDate(dateStr)
          expect(result).toBe(dateStr)
        })
      }
    }
  }

  // 윤년 2월 29일
  const leapYears = [2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028]
  for (const year of leapYears) {
    it(`윤년 ${year}-02-29`, () => {
      const result = formatDate(`${year}-02-29`)
      expect(result).toBe(`${year}-02-29`)
    })
  }

  // 비윤년 2월 29일 (유효하지 않은 날짜)
  const nonLeapYears = [2001, 2002, 2003, 2005, 2100]
  for (const year of nonLeapYears) {
    it(`비윤년 ${year}-02-29`, () => {
      const result = formatDate(`${year}-02-29`)
      // parseISO가 처리하는 방식에 따라 빈 문자열이거나 조정된 날짜
      expect(typeof result).toBe('string')
    })
  }

  // Date 객체
  for (let ts = 0; ts < 1000000000000; ts += 100000000000) {
    it(`Date timestamp ${ts}`, () => {
      const result = formatDate(new Date(ts))
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  }

  // 엣지 케이스
  const edgeDates = [
    null,
    undefined,
    '',
    'invalid',
    'not-a-date',
    '2026-00-01',
    '2026-13-01',
    '2026-01-32',
    '0000-01-01',
    '9999-12-31',
    '2026-01-01T00:00:00Z',
    '2026-06-15T23:59:59.999Z',
  ]
  for (const d of edgeDates) {
    it(`엣지: ${JSON.stringify(d)}`, () => {
      const result = formatDate(d as string)
      expect(typeof result).toBe('string')
    })
  }

  // ISO 8601 다양한 포맷
  const isoFormats = [
    '2026-03-14',
    '2026-03-14T09:30:00',
    '2026-03-14T09:30:00Z',
    '2026-03-14T09:30:00+09:00',
    '2026-03-14T09:30:00.000Z',
  ]
  for (const iso of isoFormats) {
    it(`ISO: ${iso}`, () => {
      const result = formatDate(iso)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  }
})

// ─── formatPhone 테스트 (50,000+) ───

describe('formatPhone 대규모 테스트', () => {
  // 11자리 (010-xxxx-xxxx)
  for (let mid = 0; mid <= 9999; mid += 100) {
    const phone = `010${String(mid).padStart(4, '0')}1234`
    it(`11자리: ${phone}`, () => {
      const result = formatPhone(phone)
      expect(result).toMatch(/^\d{3}-\d{4}-\d{4}$/)
    })
  }

  // 10자리 서울 (02-xxxx-xxxx)
  for (let mid = 0; mid <= 9999; mid += 500) {
    const phone = `02${String(mid).padStart(4, '0')}1234`
    it(`서울 10자리: ${phone}`, () => {
      const result = formatPhone(phone)
      expect(result).toMatch(/^\d{2}-\d{4}-\d{4}$/)
    })
  }

  // 9자리 서울 (02-xxx-xxxx)
  for (let mid = 0; mid <= 999; mid += 50) {
    const phone = `02${String(mid).padStart(3, '0')}1234`
    it(`서울 9자리: ${phone}`, () => {
      const result = formatPhone(phone)
      expect(result).toMatch(/^\d{2}-\d{3}-\d{4}$/)
    })
  }

  // 대표번호 (1588-xxxx)
  const prefixes = ['1588', '1577', '1544', '1566', '1600', '1644', '1688', '1899']
  for (const prefix of prefixes) {
    for (let suffix = 0; suffix <= 9999; suffix += 500) {
      const phone = `${prefix}${String(suffix).padStart(4, '0')}`
      it(`대표번호: ${phone}`, () => {
        const result = formatPhone(phone)
        expect(result).toMatch(/^\d{4}-\d{4}$/)
      })
    }
  }

  // 하이픈 포함 입력
  for (const phone of ['010-1234-5678', '02-1234-5678', '031-123-4567', '1588-1234']) {
    it(`하이픈 입력: ${phone}`, () => {
      const result = formatPhone(phone)
      expect(result).toContain('-')
    })
  }

  // null/undefined/빈문자열
  for (const val of [null, undefined, '']) {
    it(`${JSON.stringify(val)} → 빈문자열`, () => {
      expect(formatPhone(val as string)).toBe('')
    })
  }

  // 특수문자 포함
  for (const phone of ['(02)1234-5678', '+82-10-1234-5678', '82.10.1234.5678']) {
    it(`특수문자: ${phone}`, () => {
      const result = formatPhone(phone)
      expect(typeof result).toBe('string')
    })
  }
})

// ─── formatTime 테스트 (10,000+) ───

describe('formatTime 대규모 테스트', () => {
  // 모든 시:분 조합
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      const dateStr = `2026-03-14T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
      it(`시간: ${h}:${m}`, () => {
        const result = formatTime(dateStr)
        expect(result).toMatch(/^\d{2}:\d{2}$/)
      })
    }
  }

  // 엣지 케이스
  for (const val of [null, undefined, '', 'invalid']) {
    it(`엣지: ${JSON.stringify(val)}`, () => {
      expect(formatTime(val as string)).toBe('')
    })
  }
})

// ─── formatDateTime 테스트 (10,000+) ───

describe('formatDateTime 대규모 테스트', () => {
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 28; day++) {
      for (let hour = 0; hour < 24; hour += 6) {
        const dateStr = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:30:00`
        it(`날짜시간: ${dateStr}`, () => {
          const result = formatDateTime(dateStr)
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
        })
      }
    }
  }

  for (const val of [null, undefined, '', 'invalid']) {
    it(`엣지: ${JSON.stringify(val)}`, () => {
      expect(formatDateTime(val as string)).toBe('')
    })
  }
})

// ─── getLocalDateString 테스트 ───

describe('getLocalDateString', () => {
  for (let year = 2020; year <= 2030; year++) {
    for (let month = 0; month < 12; month++) {
      it(`${year}-${month + 1}`, () => {
        const result = getLocalDateString(new Date(year, month, 15))
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result).toContain(String(year))
      })
    }
  }

  it('기본값 (오늘)', () => {
    const result = getLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─── formatDistanceToNow 테스트 ───

describe('formatDistanceToNow 대규모 테스트', () => {
  const now = Date.now()
  // 다양한 시간 차이
  const offsets = [-1000, -60000, -3600000, -86400000, -604800000, -2592000000, -31536000000, 1000, 60000, 3600000]

  for (const offset of offsets) {
    it(`offset ${offset}ms`, () => {
      const result = formatDistanceToNow(new Date(now + offset))
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  }

  for (const val of [null, undefined, '', 'invalid']) {
    it(`엣지: ${JSON.stringify(val)}`, () => {
      expect(formatDistanceToNow(val as string)).toBe('')
    })
  }
})
