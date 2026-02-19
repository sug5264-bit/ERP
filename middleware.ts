import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

const publicPaths = ['/login', '/api/auth']

/**
 * 경로별 필요 모듈 매핑 (API + 페이지 모두)
 */
const ROUTE_MODULE_MAP: Record<string, string> = {
  '/api/v1/accounting': 'accounting',
  '/api/v1/hr': 'hr',
  '/api/v1/inventory': 'inventory',
  '/api/v1/sales': 'sales',
  '/api/v1/partners': 'sales',
  '/api/v1/approval': 'approval',
  '/api/v1/board': 'board',
  '/api/v1/projects': 'projects',
  '/api/v1/admin': 'admin',
  '/accounting': 'accounting',
  '/hr': 'hr',
  '/inventory': 'inventory',
  '/sales': 'sales',
  '/approval': 'approval',
  '/board': 'board',
  '/projects': 'projects',
  '/admin': 'admin',
}

/**
 * HTTP 메서드 → 필요 액션 매핑
 */
const METHOD_ACTION_MAP: Record<string, string> = {
  GET: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
}

/**
 * API 변경 요청 Rate Limiting (인메모리)
 * IP + 모듈 기반, 분당 30회 제한
 */
const apiRateMap = new Map<string, { count: number; resetAt: number }>()
const API_RATE_LIMIT = 30
const API_RATE_WINDOW = 60 * 1000 // 1분
const API_RATE_MAP_MAX_SIZE = 10000 // 메모리 제한
let lastCleanupAt = 0
const CLEANUP_INTERVAL = 30 * 1000 // 30초마다 정리 (매 요청마다 정리하지 않음)

function checkApiRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = apiRateMap.get(key)

  if (!entry || entry.resetAt < now) {
    // 일정 간격으로만 만료 항목 정리 (매 요청마다 O(n) 방지)
    if (apiRateMap.size >= API_RATE_MAP_MAX_SIZE && now - lastCleanupAt > CLEANUP_INTERVAL) {
      lastCleanupAt = now
      for (const [k, v] of apiRateMap) {
        if (v.resetAt < now) apiRateMap.delete(k)
      }
      if (apiRateMap.size >= API_RATE_MAP_MAX_SIZE) {
        const firstKey = apiRateMap.keys().next().value
        if (firstKey) apiRateMap.delete(firstKey)
      }
    }
    apiRateMap.set(key, { count: 1, resetAt: now + API_RATE_WINDOW })
    return true
  }

  entry.count += 1
  return entry.count <= API_RATE_LIMIT
}

// 긴 prefix부터 매칭하도록 정렬 (캐시)
const sortedRouteEntries = Object.entries(ROUTE_MODULE_MAP).sort(
  (a, b) => b[0].length - a[0].length
)

function getRequiredModule(pathname: string): string | null {
  for (const [prefix, module] of sortedRouteEntries) {
    if (pathname.startsWith(prefix)) return module
  }
  return null
}

function hasPermission(
  permissions: Array<{ module: string; action: string }>,
  roles: string[],
  module: string,
  action: string
): boolean {
  if (roles.includes('SYSTEM_ADMIN') || roles.includes('관리자')) return true
  // 부서장은 읽기, 승인만 가능하며 관리(admin) 모듈은 접근 불가
  if (roles.includes('부서장') && module !== 'admin' && (action === 'read' || action === 'approve')) return true
  return permissions.some((p) => p.module === module && p.action === action)
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') || '0.0.0.0'
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  // 공개 경로는 인증 불요
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // 정적 파일, _next 등 스킵
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 미인증 사용자 → 로그인 리다이렉트
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const method = req.method

  // API 변경 요청 보안 검증
  if (pathname.startsWith('/api/v1') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    // CSRF 보호: 커스텀 헤더 + Origin 확인
    const hasHeader = req.headers.get('x-requested-with') === 'XMLHttpRequest'
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    const originMismatch = origin && host && !origin.includes(host)

    if (!hasHeader || originMismatch) {
      return NextResponse.json(
        { success: false, error: { code: 'CSRF_ERROR', message: 'Invalid request' } },
        { status: 403 }
      )
    }

    // API Rate Limiting: IP + 모듈 기반
    const ip = getClientIp(req)
    const module = getRequiredModule(pathname) || 'general'
    const rateLimitKey = `${ip}:${module}:mutation`

    if (!checkApiRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // 권한 기반 접근 제어 (RBAC)
  const requiredModule = getRequiredModule(pathname)
  if (requiredModule) {
    const user = req.auth.user as any
    const permissions = user?.permissions || []
    const roles = user?.roles || []
    const action = METHOD_ACTION_MAP[method] || 'read'

    if (!hasPermission(permissions, roles, requiredModule, action)) {
      if (pathname.startsWith('/api/v1')) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'FORBIDDEN', message: '이 작업에 대한 권한이 없습니다.' },
          },
          { status: 403 }
        )
      }
      // 페이지 접근 시 대시보드로 리다이렉트
      return NextResponse.redirect(new URL('/dashboard?error=forbidden', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
