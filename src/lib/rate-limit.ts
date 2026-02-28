// 인메모리 Rate Limiter (로그인 등 민감한 엔드포인트용)
const attempts = new Map<string, { count: number; resetAt: number }>()

// 5분마다 만료된 항목 정리
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, val] of attempts) {
        if (val.resetAt < now) attempts.delete(key)
      }
    },
    5 * 60 * 1000
  )
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}

/**
 * 현재 rate limit 상태만 확인 (카운트를 증가시키지 않음).
 * 실패 시에만 incrementRateLimit를 호출해 카운트를 올린다.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15분
): RateLimitResult {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || entry.resetAt < now) {
    return { allowed: true, remaining: maxAttempts }
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: maxAttempts - entry.count }
}

/** 실패 횟수를 1 증가시킨다. */
export function incrementRateLimit(key: string, windowMs: number = 15 * 60 * 1000): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
  } else {
    entry.count += 1
  }
}

export function resetRateLimit(key: string) {
  attempts.delete(key)
}
