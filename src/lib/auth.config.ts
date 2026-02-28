import type { NextAuthConfig } from 'next-auth'

/**
 * Edge Runtime 호환 auth 설정 (middleware용)
 * Prisma, bcryptjs 등 Node.js 전용 모듈을 import하지 않음
 *
 * 대기업 보안 정책 반영:
 * - JWT 세션 8시간 (업무 시간 기준)
 * - 쿠키 보안 속성 강화
 * - 세션에 loginAt 타임스탬프 포함
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [], // middleware에서는 provider 불필요 (JWT 검증만)
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8시간 (업무 시간)
    updateAge: 60 * 60, // 1시간마다 토큰 갱신
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-authjs.session-token' : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn() {
      // 모든 로그인 허용 (커스텀 검증은 authorize에서 처리)
      return true
    },
    async redirect({ url, baseUrl }) {
      // 상대 경로는 baseUrl 붙여서 반환
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // 같은 origin이면 그대로
      try {
        if (new URL(url).origin === baseUrl) return url
      } catch {
        // URL 파싱 실패 시 baseUrl로
      }
      return baseUrl
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.roles = (user as any).roles
        token.permissions = (user as any).permissions
        token.employeeId = (user as any).employeeId
        token.employeeName = (user as any).employeeName
        token.departmentName = (user as any).departmentName
        token.positionName = (user as any).positionName
        token.loginAt = Date.now()
      }

      // 세션 갱신 시 타임스탬프 업데이트
      if (trigger === 'update') {
        token.lastActivity = Date.now()
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as any).roles = token.roles
        ;(session.user as any).permissions = token.permissions
        ;(session.user as any).employeeId = token.employeeId
        ;(session.user as any).employeeName = token.employeeName
        ;(session.user as any).departmentName = token.departmentName
        ;(session.user as any).positionName = token.positionName
      }
      return session
    },
  },
}
