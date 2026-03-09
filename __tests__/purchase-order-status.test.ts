import { describe, it, expect } from 'vitest'

/**
 * 구매발주 상태 전이 매트릭스 (purchasing/orders/[id]/route.ts에서 사용)
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
}

function canTransition(from: string, to: string): boolean {
  return (ALLOWED_TRANSITIONS[from] || []).includes(to)
}

describe('구매발주 상태 전이', () => {
  // === 정상 전이 ===
  describe('허용된 상태 전이', () => {
    it('ORDERED → CONFIRMED', () => {
      expect(canTransition('ORDERED', 'CONFIRMED')).toBe(true)
    })

    it('ORDERED → CANCELLED', () => {
      expect(canTransition('ORDERED', 'CANCELLED')).toBe(true)
    })

    it('CONFIRMED → SHIPPED', () => {
      expect(canTransition('CONFIRMED', 'SHIPPED')).toBe(true)
    })

    it('CONFIRMED → CANCELLED', () => {
      expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true)
    })

    it('SHIPPED → RECEIVED', () => {
      expect(canTransition('SHIPPED', 'RECEIVED')).toBe(true)
    })
  })

  // === 차단된 전이 ===
  describe('차단된 상태 전이', () => {
    it('RECEIVED → ORDERED (역방향 불가)', () => {
      expect(canTransition('RECEIVED', 'ORDERED')).toBe(false)
    })

    it('RECEIVED → CANCELLED (최종 상태에서 변경 불가)', () => {
      expect(canTransition('RECEIVED', 'CANCELLED')).toBe(false)
    })

    it('CANCELLED → ORDERED (취소 후 복원 불가)', () => {
      expect(canTransition('CANCELLED', 'ORDERED')).toBe(false)
    })

    it('CANCELLED → CONFIRMED (취소 후 변경 불가)', () => {
      expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false)
    })

    it('ORDERED → SHIPPED (단계 건너뛰기 불가)', () => {
      expect(canTransition('ORDERED', 'SHIPPED')).toBe(false)
    })

    it('ORDERED → RECEIVED (단계 건너뛰기 불가)', () => {
      expect(canTransition('ORDERED', 'RECEIVED')).toBe(false)
    })

    it('SHIPPED → CONFIRMED (역방향 불가)', () => {
      expect(canTransition('SHIPPED', 'CONFIRMED')).toBe(false)
    })

    it('SHIPPED → CANCELLED (배송 중 취소 불가)', () => {
      expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false)
    })
  })

  // === 엣지 케이스 ===
  describe('엣지 케이스', () => {
    it('동일 상태로 전이', () => {
      expect(canTransition('ORDERED', 'ORDERED')).toBe(false)
      expect(canTransition('CONFIRMED', 'CONFIRMED')).toBe(false)
    })

    it('존재하지 않는 상태', () => {
      expect(canTransition('UNKNOWN', 'ORDERED')).toBe(false)
      expect(canTransition('ORDERED', 'UNKNOWN')).toBe(false)
    })

    it('빈 문자열 상태', () => {
      expect(canTransition('', 'ORDERED')).toBe(false)
      expect(canTransition('ORDERED', '')).toBe(false)
    })
  })

  // === 전체 정상 흐름 시뮬레이션 ===
  describe('정상 흐름 시뮬레이션', () => {
    it('발주 → 확인 → 배송 → 수령 (정상 흐름)', () => {
      expect(canTransition('ORDERED', 'CONFIRMED')).toBe(true)
      expect(canTransition('CONFIRMED', 'SHIPPED')).toBe(true)
      expect(canTransition('SHIPPED', 'RECEIVED')).toBe(true)
    })

    it('발주 → 취소 (초기 취소)', () => {
      expect(canTransition('ORDERED', 'CANCELLED')).toBe(true)
    })

    it('확인 → 취소 (확인 후 취소)', () => {
      expect(canTransition('CONFIRMED', 'CANCELLED')).toBe(true)
    })
  })
})
