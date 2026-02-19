import type { NextAuthConfig } from 'next-auth'

/**
 * Edge Runtime 호환 auth 설정 (middleware용)
 * Prisma, bcryptjs 등 Node.js 전용 모듈을 import하지 않음
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [], // middleware에서는 provider 불필요 (JWT 검증만)
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8시간
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roles = (user as any).roles
        token.permissions = (user as any).permissions
        token.employeeId = (user as any).employeeId
        token.employeeName = (user as any).employeeName
        token.departmentName = (user as any).departmentName
        token.positionName = (user as any).positionName
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
