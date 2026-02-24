import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/login', '/api/auth']

// ─── In-memory Rate Limiter (프록시용 경량 버전) ───
interface RLEntry { count: number; resetAt: number }
const rlStore = new Map<string, RLEntry>()
let lastClean = Date.now()

function rateLimitCheck(key: string, windowMs: number, max: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  // 1분마다 만료 엔트리 정리
  if (now - lastClean > 60_000) {
    lastClean = now
    for (const [k, v] of rlStore) { if (now > v.resetAt) rlStore.delete(k) }
  }

  const entry = rlStore.get(key)
  if (!entry || now > entry.resetAt) {
    rlStore.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1, resetAt: now + windowMs }
  }
  entry.count++
  if (entry.count > max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }
  return { ok: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일 허용
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // ─── API Rate Limiting ───
  if (pathname.startsWith('/api/')) {
    const ip = getIp(request)
    const method = request.method

    // 로그인 API: 15분에 10회
    if (pathname.startsWith('/api/auth') && method === 'POST') {
      const { ok, resetAt } = rateLimitCheck(`login:${ip}`, 15 * 60 * 1000, 10)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMIT', message: '너무 많은 로그인 시도입니다. 15분 후 다시 시도해주세요.' } },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }
    }

    // API 쓰기(POST/PUT/DELETE): 1분에 30회
    if (!pathname.startsWith('/api/auth') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const { ok, resetAt } = rateLimitCheck(`mut:${ip}`, 60_000, 30)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }
    }

    // API 읽기(GET): 1분에 60회
    if (!pathname.startsWith('/api/auth') && method === 'GET') {
      const { ok, resetAt } = rateLimitCheck(`read:${ip}`, 60_000, 60)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
            },
          }
        )
      }
    }

    // 공개 API 경로 허용
    if (publicPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.next()
    }
  }

  // 공개 경로 허용
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // NextAuth 세션 토큰 쿠키 확인
  const token =
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 보안 헤더 적용
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
