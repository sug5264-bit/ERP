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

describe('formatCurrency', () => {
  it('정수 금액 포맷팅', () => {
    expect(formatCurrency(1000)).toBe('1,000원')
    expect(formatCurrency(1234567)).toBe('1,234,567원')
  })

  it('0원 처리', () => {
    expect(formatCurrency(0)).toBe('0원')
  })

  it('null/undefined는 0원', () => {
    expect(formatCurrency(null)).toBe('0원')
    expect(formatCurrency(undefined)).toBe('0원')
  })

  it('문자열 숫자 처리', () => {
    expect(formatCurrency('5000')).toBe('5,000원')
    expect(formatCurrency('1234.56')).toBe('1,235원')
  })

  it('음수 금액은 △ 표시', () => {
    expect(formatCurrency(-5000)).toBe('△5,000원')
    expect(formatCurrency(-123456)).toBe('△123,456원')
  })

  it('Infinity/NaN은 0원', () => {
    expect(formatCurrency(Infinity)).toBe('0원')
    expect(formatCurrency(NaN)).toBe('0원')
    expect(formatCurrency('not-a-number')).toBe('0원')
  })

  it('큰 금액 처리', () => {
    expect(formatCurrency(999999999999)).toBe('999,999,999,999원')
  })

  it('소수점은 반올림', () => {
    expect(formatCurrency(1234.56)).toBe('1,235원')
    expect(formatCurrency(1234.44)).toBe('1,234원')
  })
})

describe('formatDate', () => {
  it('Date 객체 → YYYY-MM-DD', () => {
    expect(formatDate(new Date(2024, 0, 15))).toBe('2024-01-15')
    expect(formatDate(new Date(2024, 11, 31))).toBe('2024-12-31')
  })

  it('ISO 문자열 → YYYY-MM-DD', () => {
    expect(formatDate('2024-06-15T10:30:00.000Z')).toBe('2024-06-15')
  })

  it('null/undefined는 빈 문자열', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('')).toBe('')
  })

  it('유효하지 않은 날짜는 빈 문자열', () => {
    expect(formatDate('invalid-date')).toBe('')
  })
})

describe('formatDateTime', () => {
  it('날짜+시간 포맷팅', () => {
    const result = formatDateTime(new Date(2024, 0, 15, 14, 30))
    expect(result).toMatch(/2024-01-15 14:30/)
  })

  it('null은 빈 문자열', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
  })

  it('유효하지 않은 날짜', () => {
    expect(formatDateTime('not-a-date')).toBe('')
  })
})

describe('formatPhone', () => {
  it('휴대폰 번호 11자리', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })

  it('일반 전화번호 10자리', () => {
    expect(formatPhone('0312345678')).toBe('031-234-5678')
  })

  it('서울 지역번호 10자리', () => {
    expect(formatPhone('0212345678')).toBe('02-1234-5678')
  })

  it('서울 지역번호 9자리', () => {
    expect(formatPhone('021234567')).toBe('02-123-4567')
  })

  it('대표번호 8자리', () => {
    expect(formatPhone('15881234')).toBe('1588-1234')
  })

  it('null/undefined는 빈 문자열', () => {
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
    expect(formatPhone('')).toBe('')
  })

  it('이미 하이픈이 있는 번호는 정리 후 포맷', () => {
    expect(formatPhone('010-1234-5678')).toBe('010-1234-5678')
  })

  it('알 수 없는 형식은 원본 반환', () => {
    expect(formatPhone('12345')).toBe('12345')
  })
})

describe('formatTime', () => {
  it('시간만 추출', () => {
    expect(formatTime(new Date(2024, 0, 1, 9, 30))).toBe('09:30')
    expect(formatTime(new Date(2024, 0, 1, 14, 0))).toBe('14:00')
  })

  it('null은 빈 문자열', () => {
    expect(formatTime(null)).toBe('')
  })
})

describe('getLocalDateString', () => {
  it('오늘 날짜를 YYYY-MM-DD 형식으로 반환', () => {
    const result = getLocalDateString()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('특정 날짜를 포맷', () => {
    expect(getLocalDateString(new Date(2024, 5, 15))).toBe('2024-06-15')
  })
})

describe('formatDistanceToNow', () => {
  it('null은 빈 문자열', () => {
    expect(formatDistanceToNow(null)).toBe('')
    expect(formatDistanceToNow(undefined)).toBe('')
  })

  it('유효하지 않은 날짜는 빈 문자열', () => {
    expect(formatDistanceToNow('invalid')).toBe('')
  })

  it('유효한 날짜는 상대 시간 반환', () => {
    const recentDate = new Date(Date.now() - 60 * 1000) // 1분 전
    const result = formatDistanceToNow(recentDate)
    expect(result.length).toBeGreaterThan(0)
  })
})
