import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { authConfig } from '@/lib/auth.config'

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        // Rate limiting: 15분 내 5회 실패 시 차단
        const rateLimitKey = `login:${credentials.username}`
        const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)
        if (!rateCheck.allowed) {
          throw new Error(`로그인 시도가 너무 많습니다. ${rateCheck.retryAfterSeconds}초 후 다시 시도해주세요.`)
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: { permission: true },
                    },
                  },
                },
              },
            },
            employee: {
              include: {
                department: true,
                position: true,
              },
            },
          },
        })

        if (!user || !user.isActive) {
          return null
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isPasswordValid) {
          return null
        }

        // 로그인 성공 시 rate limit 초기화
        resetRateLimit(rateLimitKey)

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        const roles = user.userRoles.map((ur) => ur.role.name)
        const permissions = user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => ({
            module: rp.permission.module,
            action: rp.permission.action,
          }))
        )

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles,
          permissions,
          employeeId: user.employeeId,
          employeeName: user.employee?.nameKo ?? null,
          departmentName: user.employee?.department?.name ?? null,
          positionName: user.employee?.position?.name ?? null,
        }
      },
    }),
  ],
})
