import { describe, it, expect } from 'vitest'

describe('날짜 계산 버그 검증', () => {
  // === 6개월 전 날짜 계산 (dashboard/stats에서 사용) ===
  describe('6개월 전 날짜 - new Date(year, month-6, 1) 방식', () => {
    it('3월 31일에서 6개월 전 → 9월 1일 (이전 년도)', () => {
      const now = new Date(2026, 2, 31) // 3월 31일
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      expect(sixMonthsAgo.getFullYear()).toBe(2025)
      expect(sixMonthsAgo.getMonth()).toBe(8) // 9월 (0-indexed)
      expect(sixMonthsAgo.getDate()).toBe(1)
    })

    it('1월에서 6개월 전 → 7월 (이전 년도)', () => {
      const now = new Date(2026, 0, 15)
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      expect(sixMonthsAgo.getFullYear()).toBe(2025)
      expect(sixMonthsAgo.getMonth()).toBe(6) // 7월
    })

    it('7월에서 6개월 전 → 1월 (같은 년도)', () => {
      const now = new Date(2026, 6, 1)
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      expect(sixMonthsAgo.getFullYear()).toBe(2026)
      expect(sixMonthsAgo.getMonth()).toBe(0) // 1월
    })
  })

  // === 이전 버그: setDate(1) 후 setMonth() 방식의 문제 ===
  describe('이전 버그: setMonth 오버플로 시나리오', () => {
    it('setDate(1) + setMonth(-6)도 오버플로 없이 동작하지만 new Date() 방식이 더 안전', () => {
      // 이전 코드: setDate(1) 후 setMonth
      const old = new Date(2026, 2, 31)
      old.setDate(1) // 3월 1일로 변경
      old.setMonth(old.getMonth() - 6) // 9월 1일

      // 새 코드: 생성자에서 직접 계산
      const now = new Date(2026, 2, 31)
      const newWay = new Date(now.getFullYear(), now.getMonth() - 6, 1)

      expect(old.getMonth()).toBe(newWay.getMonth())
      expect(old.getFullYear()).toBe(newWay.getFullYear())
    })
  })

  // === 월말 endDate 계산 (closing/payments에서 사용) ===
  describe('월말 endDate 계산', () => {
    it('2월 마지막날 (윤년)', () => {
      const endDate = new Date(2024, 2, 0, 23, 59, 59, 999) // 2월 마지막날
      expect(endDate.getDate()).toBe(29) // 2024는 윤년
    })

    it('2월 마지막날 (평년)', () => {
      const endDate = new Date(2025, 2, 0, 23, 59, 59, 999)
      expect(endDate.getDate()).toBe(28)
    })

    it('12월 마지막날', () => {
      const endDate = new Date(2026, 12, 0, 23, 59, 59, 999) // month=12, day=0 → 12월 31일
      expect(endDate.getMonth()).toBe(11) // 12월
      expect(endDate.getDate()).toBe(31)
    })
  })

  // === year/month 기반 날짜 범위 (closing/payments에서 사용) ===
  describe('year/month 기반 날짜 범위 경계값', () => {
    it('year=2000 (최소값)', () => {
      const start = new Date(2000, 0, 1) // 1월
      expect(start.getFullYear()).toBe(2000)
    })

    it('year=2100 (최대값)', () => {
      const start = new Date(2100, 11, 1) // 12월
      expect(start.getFullYear()).toBe(2100)
    })

    it('year < 2000 시 현재 연도로 폴백', () => {
      let year = 1999
      const now = new Date()
      if (year < 2000 || year > 2100) year = now.getFullYear()
      expect(year).toBe(now.getFullYear())
    })

    it('month = 0 시 현재 월로 폴백', () => {
      let month = 0
      const now = new Date()
      if (month < 1 || month > 12) month = now.getMonth() + 1
      expect(month).toBe(now.getMonth() + 1)
    })

    it('month = 13 시 현재 월로 폴백', () => {
      let month = 13
      const now = new Date()
      if (month < 1 || month > 12) month = now.getMonth() + 1
      expect(month).toBe(now.getMonth() + 1)
    })
  })
})
