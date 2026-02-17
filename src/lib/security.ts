import { NextRequest, NextResponse } from 'next/server'

/**
 * 보안 헤더 설정
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // XSS 방지
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  // HSTS
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  // Referrer
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // Permissions Policy
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}

/**
 * Rate limiter (메모리 기반 간이 구현)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(
  ip: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false // rate limited
  }

  entry.count++
  return true
}

/**
 * CSRF 토큰 검증 (Double Submit Cookie 패턴)
 */
export function validateCsrf(request: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true

  // API 요청은 Content-Type 헤더로 검증
  const contentType = request.headers.get('content-type')
  if (contentType?.includes('application/json')) return true

  return false
}

/**
 * 로그인 시도 제한 (brute force 방지)
 */
const loginAttemptMap = new Map<string, { count: number; blockedUntil: number }>()

export function checkLoginAttempt(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = loginAttemptMap.get(ip)

  if (!entry) return { allowed: true }

  if (now < entry.blockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) }
  }

  if (entry.count >= 5) {
    // 5회 이상 실패 시 5분 차단
    entry.blockedUntil = now + 300000
    return { allowed: false, retryAfter: 300 }
  }

  return { allowed: true }
}

export function recordLoginAttempt(ip: string, success: boolean) {
  if (success) {
    loginAttemptMap.delete(ip)
    return
  }

  const entry = loginAttemptMap.get(ip) || { count: 0, blockedUntil: 0 }
  entry.count++
  loginAttemptMap.set(ip, entry)
}

/**
 * 세션 하이재킹 방지를 위한 IP 검증
 */
export function validateSessionIp(sessionIp: string | undefined, currentIp: string): boolean {
  if (!sessionIp) return true // 최초 세션
  return sessionIp === currentIp
}

// 주기적 클린업 (메모리 누수 방지)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) rateLimitMap.delete(key)
    }
    for (const [key, value] of loginAttemptMap.entries()) {
      if (now > value.blockedUntil + 600000) loginAttemptMap.delete(key)
    }
  }, 60000)
}
