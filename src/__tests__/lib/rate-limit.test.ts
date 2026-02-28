import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, incrementRateLimit, resetRateLimit } from '@/lib/rate-limit'

describe('Rate Limiter', () => {
  beforeEach(() => {
    // 테스트 간 독립성을 위해 키 초기화
    resetRateLimit('test-key')
  })

  it('첫 번째 요청은 허용', () => {
    const result = checkRateLimit('test-key', 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it('제한 횟수 내에서는 허용', () => {
    for (let i = 0; i < 4; i++) {
      incrementRateLimit('test-key', 60000)
    }
    const result = checkRateLimit('test-key', 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it('제한 횟수 초과 시 차단', () => {
    for (let i = 0; i < 5; i++) {
      incrementRateLimit('test-key', 60000)
    }
    const result = checkRateLimit('test-key', 5, 60000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('reset 후 다시 허용', () => {
    for (let i = 0; i < 6; i++) {
      incrementRateLimit('test-key', 60000)
    }
    resetRateLimit('test-key')
    const result = checkRateLimit('test-key', 5, 60000)
    expect(result.allowed).toBe(true)
  })

  it('다른 키는 독립적', () => {
    for (let i = 0; i < 6; i++) {
      incrementRateLimit('key-a', 60000)
    }
    const resultA = checkRateLimit('key-a', 5, 60000)
    const resultB = checkRateLimit('key-b', 5, 60000)

    expect(resultA.allowed).toBe(false)
    expect(resultB.allowed).toBe(true)

    resetRateLimit('key-a')
    resetRateLimit('key-b')
  })
})
