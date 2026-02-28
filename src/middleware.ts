import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicPaths = ['/login', '/api/auth']

// 헬스체크는 인증/레이트리밋 없이 항상 허용
const bypassPaths = ['/api/health']

// ─── In-memory Rate Limiter (프록시용 경량 버전) ───
interface RLEntry {
  count: number
  resetAt: number
}
const rlStore = new Map<string, RLEntry>()
let lastClean = Date.now()

// Rate limit 임계값을 초과한 IP를 일시적으로 블록 (자동 차단)
const blockedIps = new Map<string, number>()
const BLOCK_DURATION_MS = 5 * 60 * 1000 // 5분

function rateLimitCheck(
  key: string,
  windowMs: number,
  max: number
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  // 1분마다 만료 엔트리 정리
  if (now - lastClean > 60_000) {
    lastClean = now
    for (const [k, v] of rlStore) {
      if (now > v.resetAt) rlStore.delete(k)
    }
    for (const [ip, blockedUntil] of blockedIps) {
      if (now > blockedUntil) blockedIps.delete(ip)
    }
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
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

// ─── Request ID 생성 (Edge Runtime 호환) ───
let edgeReqCounter = 0
function generateEdgeRequestId(): string {
  const ts = Date.now().toString(36)
  const seq = (edgeReqCounter++ & 0xffff).toString(36).padStart(3, '0')
  return `${ts}-${seq}`
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일 허용 (확장자 패턴을 명시적으로 제한하여 API 경로 우회 방지)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|webp|avif|map)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  // 헬스체크 경로 바이패스
  if (bypassPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // ─── Request ID 주입 ───
  const requestId = request.headers.get('x-request-id') || generateEdgeRequestId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  // ─── 블록된 IP 체크 ───
  const ip = getIp(request)
  const blockedUntil = blockedIps.get(ip)
  if (blockedUntil && Date.now() < blockedUntil) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: '비정상적인 요청이 감지되어 일시적으로 차단되었습니다.',
        },
      },
      {
        status: 403,
        headers: { 'X-Request-Id': requestId },
      }
    )
  }

  // ─── API Rate Limiting ───
  if (pathname.startsWith('/api/')) {
    const method = request.method

    // 로그인 API: 15분에 10회
    if (pathname.startsWith('/api/auth') && method === 'POST') {
      const { ok, resetAt } = rateLimitCheck(`login:${ip}`, 15 * 60 * 1000, 10)
      if (!ok) {
        // 로그인 시도 과다 → IP 블록
        blockedIps.set(ip, Date.now() + BLOCK_DURATION_MS)
        return NextResponse.json(
          {
            success: false,
            error: { code: 'RATE_LIMIT', message: '너무 많은 로그인 시도입니다. 15분 후 다시 시도해주세요.' },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
              'X-Request-Id': requestId,
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
          {
            success: false,
            error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
              'X-Request-Id': requestId,
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
          {
            success: false,
            error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
              'X-Request-Id': requestId,
            },
          }
        )
      }
    }

    // 공개 API 경로 허용
    if (publicPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.next({
        request: { headers: requestHeaders },
      })
    }
  }

  // 공개 경로 허용
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  // NextAuth 세션 토큰 쿠키 확인
  const token =
    request.cookies.get('authjs.session-token')?.value || request.cookies.get('__Secure-authjs.session-token')?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 보안 헤더는 next.config.ts headers()에서 일괄 관리
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
