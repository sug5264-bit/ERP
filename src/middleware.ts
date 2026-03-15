import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

const publicPaths = ['/login', '/api/auth']

// 헬스체크 및 초기화 엔드포인트는 인증 없이 허용 (init 자체에서 보안 로직 처리)
const bypassPaths = ['/api/health']
const bypassExcludePaths: string[] = []

// ─── In-memory Rate Limiter (프록시용 경량 버전) ───
interface RLEntry {
  count: number
  resetAt: number
}
const rlStore = new Map<string, RLEntry>()
const MAX_RL_ENTRIES = 5000 // 메모리 누수 방지
let lastClean = Date.now()

// Rate limit 임계값을 초과한 IP를 일시적으로 블록 (자동 차단)
const blockedIps = new Map<string, number>()
const MAX_BLOCKED_ENTRIES = 1000
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

  // 최대 엔트리 초과 시 가장 오래된 항목 제거
  if (rlStore.size >= MAX_RL_ENTRIES) {
    const firstKey = rlStore.keys().next().value
    if (firstKey) rlStore.delete(firstKey)
  }
  if (blockedIps.size >= MAX_BLOCKED_ENTRIES) {
    const firstKey = blockedIps.keys().next().value
    if (firstKey) blockedIps.delete(firstKey)
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

// IPv4: 1-3자리.1-3자리.1-3자리.1-3자리, IPv6: hex:hex 형식
const IPV4_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/
const IPV6_PATTERN = /^[0-9a-fA-F:]+$/

function isValidIp(ip: string): boolean {
  if (IPV4_PATTERN.test(ip)) {
    // 각 옥텟이 0-255 범위인지 검증
    return ip.split('.').every((octet) => {
      const n = Number(octet)
      return n >= 0 && n <= 255
    })
  }
  // IPv6 또는 IPv4-mapped IPv6 (::ffff:x.x.x.x)
  return IPV6_PATTERN.test(ip) && ip.length <= 45
}

function getIp(req: { headers: Headers }): string {
  // x-real-ip(리버스 프록시 설정)를 우선 신뢰, x-forwarded-for는 마지막 프록시가 추가한 첫 번째 IP 사용
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp && isValidIp(realIp)) return realIp

  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp && isValidIp(firstIp)) return firstIp
  }

  return 'unknown'
}

// ─── Request ID 생성 (Edge Runtime 호환) ───
let edgeReqCounter = 0
function generateEdgeRequestId(): string {
  const ts = Date.now().toString(36)
  const seq = (edgeReqCounter++ & 0xffff).toString(36).padStart(3, '0')
  return `${ts}-${seq}`
}

// ─── CSP Nonce 기반 보안 ───
// Next.js는 하이드레이션을 위해 인라인 스크립트를 주입하므로,
// nonce 기반 CSP로 이를 안전하게 허용합니다.
function generateCspHeaders(nonce: string) {
  const csp = [
    "default-src 'self'",
    // nonce 기반 인라인 스크립트 허용 + strict-dynamic으로 하이드레이션 스크립트 지원
    process.env.NODE_ENV === 'production'
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
  return csp
}

export default auth((request) => {
  const { pathname } = request.nextUrl

  // 정적 파일 허용 (확장자 패턴을 명시적으로 제한하여 API 경로 우회 방지)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|eot|webp|avif|map)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  // 헬스체크 경로 바이패스 (메인 헬스체크만 - init/reset-admin/seed는 인증 필요)
  if (
    bypassPaths.some((path) => pathname === path || pathname.startsWith(path + '/')) &&
    !bypassExcludePaths.some((path) => pathname === path || pathname.startsWith(path + '/'))
  ) {
    return NextResponse.next()
  }

  // ─── Request ID 주입 ───
  const requestId = request.headers.get('x-request-id') || generateEdgeRequestId()
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  // ─── CSP Nonce 생성 ───
  // Edge Runtime 호환: crypto.getRandomValues()로 16바이트 난수 생성 후 base64 변환
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const nonce = btoa(String.fromCharCode(...nonceBytes))
  requestHeaders.set('x-nonce', nonce)
  const cspHeader = generateCspHeaders(nonce)

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

    // API 쓰기(POST/PUT/DELETE): 1분에 60회 (파일 업로드 다건 지원)
    if (!pathname.startsWith('/api/auth') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const { ok, resetAt } = rateLimitCheck(`mut:${ip}`, 60_000, 60)
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
      const rlResult = rateLimitCheck(`read:${ip}`, 60_000, 60)
      if (!rlResult.ok) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rlResult.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Remaining': '0',
              'X-Request-Id': requestId,
            },
          }
        )
      }
      requestHeaders.set('x-ratelimit-remaining', String(rlResult.remaining))
      requestHeaders.set('x-ratelimit-limit', '60')
    }

    // 공개 API 경로 허용 (정확 매칭 또는 하위 경로만 허용)
    if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
      const res = NextResponse.next({
        request: { headers: requestHeaders },
      })
      res.headers.set('Content-Security-Policy', cspHeader)
      return res
    }
  }

  // 공개 경로 허용 (정확 매칭 또는 하위 경로만 허용)
  if (publicPaths.some((path) => pathname === path || pathname.startsWith(path + '/'))) {
    const res = NextResponse.next({
      request: { headers: requestHeaders },
    })
    res.headers.set('Content-Security-Policy', cspHeader)
    return res
  }

  // NextAuth auth() 래퍼가 자동으로 JWT/쿠키를 파싱하여 request.auth에 세션 주입
  if (!request.auth) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    const res = NextResponse.redirect(loginUrl)
    res.headers.set('Content-Security-Policy', cspHeader)
    return res
  }

  // CSP 헤더를 미들웨어에서 동적으로 설정 (nonce 기반)
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', cspHeader)

  // API GET 요청에 캐시 힌트 헤더 추가 (브라우저 캐시 최적화)
  if (pathname.startsWith('/api/') && request.method === 'GET') {
    // 마스터 데이터 (거래처, 품목, 부서 등)는 30초 캐시
    if (pathname.match(/\/(partners|items|departments|positions|accounts|company)(\/|$)/)) {
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    }
  }

  return response
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)', '/shipper/:path*'],
}
