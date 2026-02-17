/**
 * In-memory Rate Limiter (서버리스 호환)
 * - Vercel Serverless에서는 인스턴스별 메모리이므로 완벽하진 않지만
 *   추가 비용 없이 기본적인 보호를 제공
 * - 자동으로 만료된 엔트리 정리
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// 주기적으로 만료된 엔트리 정리 (메모리 누수 방지)
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60 * 1000 // 1분

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}

interface RateLimitConfig {
  /** 윈도우 시간 (ms) */
  windowMs: number
  /** 윈도우 내 최대 요청 수 */
  maxRequests: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  // 새 윈도우 시작
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    }
  }

  // 기존 윈도우 내 요청
  entry.count++
  if (entry.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

// 사전 정의된 Rate Limit 설정
export const RATE_LIMITS = {
  /** 로그인: 15분에 10회 */
  login: { windowMs: 15 * 60 * 1000, maxRequests: 10 },
  /** API 쓰기(POST/PUT/DELETE): 1분에 30회 */
  apiMutation: { windowMs: 60 * 1000, maxRequests: 30 },
  /** API 읽기(GET): 1분에 60회 */
  apiRead: { windowMs: 60 * 1000, maxRequests: 60 },
} as const

/**
 * IP 주소 추출 (Vercel 환경 대응)
 */
export function getClientIp(request: Request): string {
  const headers = new Headers(request.headers)
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
