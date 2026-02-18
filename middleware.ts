import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

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

function getRequiredModule(pathname: string): string | null {
  for (const [prefix, module] of Object.entries(ROUTE_MODULE_MAP)) {
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
  if (roles.includes('부서장') && (action === 'read' || action === 'approve')) return true
  return permissions.some((p) => p.module === module && p.action === action)
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

  // CSRF 보호: 변경 요청에 커스텀 헤더 확인
  const method = req.method
  if (
    pathname.startsWith('/api/v1') &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  ) {
    const hasHeader = req.headers.get('x-requested-with') === 'XMLHttpRequest'
    if (!hasHeader) {
      return NextResponse.json(
        { success: false, error: { code: 'CSRF_ERROR', message: 'Invalid request' } },
        { status: 403 }
      )
    }
  }

  // 권한 기반 접근 제어 (RBAC)
  const requiredModule = getRequiredModule(pathname)
  if (requiredModule) {
    const user = req.auth.user as any
    const permissions = user?.permissions || []
    const roles = user?.roles || []

    // 대시보드, 마이페이지, 검색 API는 인증만 되면 접근 가능
    if (pathname === '/dashboard' || pathname.startsWith('/mypage') || pathname.startsWith('/api/v1/search') || pathname.startsWith('/api/v1/dashboard')) {
      return NextResponse.next()
    }

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
