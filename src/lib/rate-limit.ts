// 인메모리 Rate Limiter (로그인 등 민감한 엔드포인트용)
const attempts = new Map<string, { count: number; resetAt: number }>()

// 5분마다 만료된 항목 정리
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of attempts) {
      if (val.resetAt < now) attempts.delete(key)
    }
  }, 5 * 60 * 1000)
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15분
): RateLimitResult {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1 }
  }

  entry.count += 1

  if (entry.count > maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }

  return { allowed: true, remaining: maxAttempts - entry.count }
}

export function resetRateLimit(key: string) {
  attempts.delete(key)
}
