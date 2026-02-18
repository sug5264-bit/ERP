import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const publicPaths = ['/login', '/api/auth']

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

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
