import { prisma } from '@/lib/prisma'

// ─── DB 기반 로그인 Rate Limiter ───────────────────────────────────────────
// 서버리스 환경에서 인메모리 상태는 인스턴스 간 공유가 되지 않습니다.
// 로그인 시도는 login_attempts 테이블에 기록하여 인스턴스 간 정확한 차단을 보장합니다.

const LOGIN_MAX_FAILURES = 5 // 차단 임계값: 15분 내 실패 5회
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15분
const CLEANUP_BATCH = 500 // 한 번에 정리할 최대 레코드 수

/**
 * DB 기반 로그인 실패 횟수 확인.
 * 최근 windowMs 안에 username 기준 실패 횟수를 조회합니다.
 */
export async function checkLoginRateLimit(
  username: string,
  ipAddress: string,
  maxFailures: number = LOGIN_MAX_FAILURES,
  windowMs: number = LOGIN_WINDOW_MS
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - windowMs)

  const failCount = await prisma.loginAttempt.count({
    where: {
      username,
      success: false,
      createdAt: { gte: since },
    },
  })

  if (failCount >= maxFailures) {
    // IP 기반으로도 추가 확인 (계정 열거 공격 방어)
    const ipFailCount = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        createdAt: { gte: since },
      },
    })
    if (ipFailCount >= maxFailures * 2) {
      return { allowed: false, remaining: 0 }
    }
    return { allowed: false, remaining: 0 }
  }

  return { allowed: true, remaining: maxFailures - failCount }
}

/**
 * 로그인 시도 결과를 DB에 기록.
 * 성공/실패 모두 기록하며, 성공 시에는 이전 실패 기록이 자연히 만료됩니다.
 */
export async function recordLoginAttempt(username: string, ipAddress: string, success: boolean): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        username,
        ipAddress,
        success,
      },
    })

    // 오래된 레코드 비동기 정리 (30일 이상)
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {
      // 정리 실패는 무시 (기능에 영향 없음)
    })
  } catch {
    // 기록 실패해도 로그인 흐름은 계속 진행
  }
}

/**
 * 로그인 성공 후 해당 username의 실패 기록 수동 초기화 (선택적).
 * 실제로는 windowMs 만료로 자연히 해소되므로 호출하지 않아도 됩니다.
 */
export async function clearLoginAttempts(username: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: { username, success: false },
    })
  } catch {
    // 무시
  }
}

// ─── 미들웨어용 경량 인메모리 Rate Limiter ────────────────────────────────
// Edge Runtime(미들웨어)에서는 Prisma를 사용할 수 없으므로 인메모리를 유지합니다.
// 주의: 서버리스에서 인스턴스 간 공유가 안 되므로 보조적인 역할만 수행합니다.
// 로그인 rate limiting의 정확성은 위 DB 기반 함수에서 보장합니다.

const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ENTRIES = 10000

if (typeof setInterval !== 'undefined') {
  const intervalId = setInterval(
    () => {
      const now = Date.now()
      for (const [key, val] of attempts) {
        if (val.resetAt < now) attempts.delete(key)
      }
    },
    5 * 60 * 1000
  )
  if (typeof intervalId === 'object' && 'unref' in intervalId) {
    intervalId.unref()
  }
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
}

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  _windowMs: number = 15 * 60 * 1000
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

export function incrementRateLimit(key: string, windowMs: number = 15 * 60 * 1000): void {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    if (attempts.size >= MAX_ENTRIES) {
      for (const [k, v] of attempts) {
        if (v.resetAt < now) attempts.delete(k)
      }
      if (attempts.size >= MAX_ENTRIES) {
        const firstKey = attempts.keys().next().value
        if (firstKey) attempts.delete(firstKey)
      }
    }
    attempts.set(key, { count: 1, resetAt: now + windowMs })
  } else {
    entry.count += 1
  }
}

export function resetRateLimit(key: string) {
  attempts.delete(key)
}

export { CLEANUP_BATCH }
