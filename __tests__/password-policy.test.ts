import { describe, it, expect } from 'vitest'

/**
 * 비밀번호 정책 검증 로직 (mypage/route.ts에서 사용하는 것과 동일)
 */
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8 || password.length > 72) {
    return { valid: false, error: '비밀번호는 8자 이상 72자 이하여야 합니다.' }
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, error: '영문자를 1자 이상 포함해야 합니다.' }
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: '숫자를 1자 이상 포함해야 합니다.' }
  }
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/`~]/.test(password)) {
    return { valid: false, error: '특수문자를 1자 이상 포함해야 합니다.' }
  }
  return { valid: true }
}

describe('비밀번호 정책', () => {
  // === 유효한 비밀번호 ===
  describe('유효한 비밀번호', () => {
    it('영문 + 숫자 + 특수문자 포함 8자', () => {
      expect(validatePassword('Pass1!ab')).toEqual({ valid: true })
    })

    it('긴 비밀번호 (72자)', () => {
      const pw = 'A1!' + 'a'.repeat(69)
      expect(validatePassword(pw)).toEqual({ valid: true })
    })

    it('한글 포함 비밀번호', () => {
      expect(validatePassword('Pass1!한글abc')).toEqual({ valid: true })
    })

    it('다양한 특수문자', () => {
      expect(validatePassword('Test1@#$')).toEqual({ valid: true })
      expect(validatePassword('Test1[{|}')).toEqual({ valid: true })
      expect(validatePassword("Test1;:'<")).toEqual({ valid: true })
    })
  })

  // === 무효한 비밀번호 ===
  describe('무효한 비밀번호', () => {
    it('7자는 거부 (최소 8자)', () => {
      expect(validatePassword('Aa1!xxx').valid).toBe(false) // 7자
      expect(validatePassword('Aa1!xx').valid).toBe(false) // 6자
    })

    it('73자 초과', () => {
      const pw = 'A1!' + 'a'.repeat(70)
      expect(pw.length).toBe(73)
      expect(validatePassword(pw).valid).toBe(false)
    })

    it('영문 없음 (숫자 + 특수문자만)', () => {
      expect(validatePassword('12345678!').valid).toBe(false)
    })

    it('숫자 없음 (영문 + 특수문자만)', () => {
      expect(validatePassword('abcdefgh!').valid).toBe(false)
    })

    it('특수문자 없음 (영문 + 숫자만)', () => {
      expect(validatePassword('abcdefg1').valid).toBe(false)
    })

    it('빈 문자열', () => {
      expect(validatePassword('').valid).toBe(false)
    })

    it('공백만', () => {
      expect(validatePassword('        ').valid).toBe(false) // 영문/숫자/특수문자 없음
    })
  })

  // === 경계값 테스트 ===
  describe('경계값', () => {
    it('정확히 8자 (최소 길이)', () => {
      expect(validatePassword('Abcdef1!').valid).toBe(true)
    })

    it('정확히 72자 (최대 길이)', () => {
      const pw = 'A1!' + 'b'.repeat(69)
      expect(pw.length).toBe(72)
      expect(validatePassword(pw).valid).toBe(true)
    })
  })

  // === 보안 공격 패턴 ===
  describe('보안 공격 패턴', () => {
    it('SQL 인젝션 시도 비밀번호', () => {
      // 유효한 형식이면 허용 (SQL은 Prisma가 방어)
      expect(validatePassword("'; DROP TABLE--1Aa!")).toEqual({ valid: true })
    })

    it('XSS 패턴 비밀번호', () => {
      expect(validatePassword('<script>1A!</script>')).toEqual({ valid: true })
    })

    it('null byte 포함', () => {
      // 실제로는 서버에서 sanitize해야 함
      const pw = 'Test1!\x00abc'
      expect(validatePassword(pw).valid).toBe(true) // 형식은 맞음
    })
  })
})
