import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatDateTime, formatPhone, formatDistanceToNow } from '@/lib/format'

describe('formatCurrency', () => {
  it('숫자를 한국식 통화 형식으로 변환', () => {
    expect(formatCurrency(1000)).toBe('1,000')
    expect(formatCurrency(1234567)).toBe('1,234,567')
  })

  it('문자열 숫자를 처리', () => {
    expect(formatCurrency('50000')).toBe('50,000')
    expect(formatCurrency('1234.56')).toBe('1,235')
  })

  it('null/undefined는 0 반환', () => {
    expect(formatCurrency(null)).toBe('0')
    expect(formatCurrency(undefined)).toBe('0')
  })

  it('0은 올바르게 처리', () => {
    expect(formatCurrency(0)).toBe('0')
  })

  it('음수를 처리', () => {
    expect(formatCurrency(-1500)).toBe('-1,500')
  })

  it('소수점 이하 버림 (최대 소수점 0자리)', () => {
    expect(formatCurrency(1234.99)).toBe('1,235')
    expect(formatCurrency(1234.01)).toBe('1,234')
  })

  it('매우 큰 숫자를 처리', () => {
    expect(formatCurrency(999999999999)).toBe('999,999,999,999')
  })
})

describe('formatDate', () => {
  it('Date 객체를 yyyy-MM-dd로 변환', () => {
    const date = new Date(2024, 0, 15) // 2024-01-15
    expect(formatDate(date)).toBe('2024-01-15')
  })

  it('ISO 문자열을 yyyy-MM-dd로 변환', () => {
    expect(formatDate('2024-06-30T12:00:00.000Z')).toBe('2024-06-30')
  })

  it('날짜 문자열 yyyy-MM-dd 형식 처리', () => {
    expect(formatDate('2024-12-25')).toBe('2024-12-25')
  })

  it('null/undefined/빈 문자열은 빈 문자열 반환', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })
})

describe('formatDateTime', () => {
  it('Date 객체를 yyyy-MM-dd HH:mm로 변환', () => {
    const date = new Date(2024, 5, 15, 14, 30) // 2024-06-15 14:30
    const result = formatDateTime(date)
    expect(result).toMatch(/2024-06-15 14:30/)
  })

  it('ISO 문자열을 날짜+시간으로 변환', () => {
    const result = formatDateTime('2024-06-15T09:30:00')
    expect(result).toContain('2024-06-15')
    expect(result).toContain('09:30')
  })

  it('null/undefined는 빈 문자열 반환', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
  })
})

describe('formatPhone', () => {
  it('11자리 전화번호 형식화 (010-XXXX-XXXX)', () => {
    expect(formatPhone('01012345678')).toBe('010-1234-5678')
  })

  it('10자리 전화번호 형식화 (02-XXXX-XXXX)', () => {
    expect(formatPhone('0212345678')).toBe('02-1234-5678')
  })

  it('이미 형식화된 번호에서 숫자 추출 후 재형식화', () => {
    expect(formatPhone('010-1234-5678')).toBe('010-1234-5678')
  })

  it('null/undefined/빈 문자열은 빈 문자열 반환', () => {
    expect(formatPhone(null)).toBe('')
    expect(formatPhone(undefined)).toBe('')
    expect(formatPhone('')).toBe('')
  })

  it('비표준 길이 번호는 원본 반환', () => {
    expect(formatPhone('123')).toBe('123')
  })
})

describe('formatDistanceToNow', () => {
  it('최근 날짜는 상대 시간 반환', () => {
    const recent = new Date(Date.now() - 60000) // 1분 전
    const result = formatDistanceToNow(recent)
    expect(result).toBeTruthy()
    expect(result.length).toBeGreaterThan(0)
  })

  it('null/undefined는 빈 문자열 반환', () => {
    expect(formatDistanceToNow(null)).toBe('')
    expect(formatDistanceToNow(undefined)).toBe('')
  })

  it('ISO 문자열 입력 지원', () => {
    const result = formatDistanceToNow(new Date(Date.now() - 3600000).toISOString())
    expect(result).toBeTruthy()
  })
})
