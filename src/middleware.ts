import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const publicPaths = ['/login', '/api/auth']

const modulePathMap: Record<string, string> = {
  '/accounting': 'accounting',
  '/hr': 'hr',
  '/inventory': 'inventory',
  '/sales': 'sales',
  '/approval': 'approval',
  '/board': 'board',
  '/admin': 'admin',
}

export default auth((req) => {
  const { pathname } = req.nextUrl

  // 공개 경로 허용
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // 정적 파일 허용
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // 미인증 사용자 → 로그인으로 리다이렉트
  if (!req.auth) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 관리자 페이지 접근 제어
  if (pathname.startsWith('/admin')) {
    const roles = (req.auth.user as any)?.roles || []
    if (!roles.includes('SYSTEM_ADMIN')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // 모듈별 권한 확인
  const permissions = (req.auth.user as any)?.permissions || []
  for (const [path, module] of Object.entries(modulePathMap)) {
    if (pathname.startsWith(path)) {
      const hasAccess = permissions.some(
        (p: any) => p.module === module && p.action === 'read'
      )
      if (!hasAccess) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      break
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
