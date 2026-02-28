import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { authConfig } from '@/lib/auth.config'
import { logger } from '@/lib/logger'

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
        try {
          const username = credentials?.username
          const password = credentials?.password

          if (!username || !password) {
            logger.warn('Login attempt with missing credentials')
            return null
          }

          const usernameStr = String(username)
          const passwordStr = String(password)

          // Rate limiting: 15분 내 5회 실패 시 차단
          const rateLimitKey = `login:${usernameStr}`
          const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)
          if (!rateCheck.allowed) {
            logger.warn('Login rate limit exceeded', { module: 'auth', action: 'login' })
            return null
          }

          const user = await prisma.user.findUnique({
            where: { username: usernameStr },
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

          if (!user) {
            incrementRateLimit(rateLimitKey)
            logger.warn('Login failed: user not found', { module: 'auth', action: 'login' })
            return null
          }

          if (!user.isActive) {
            incrementRateLimit(rateLimitKey)
            logger.warn('Login failed: user inactive', { module: 'auth', action: 'login', userId: user.id })
            return null
          }

          const isPasswordValid = await compare(passwordStr, user.passwordHash)

          if (!isPasswordValid) {
            incrementRateLimit(rateLimitKey)
            logger.warn('Login failed: invalid password', { module: 'auth', action: 'login', userId: user.id })
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

          logger.info('Login successful', { module: 'auth', action: 'login', userId: user.id })

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
        } catch (error) {
          logger.error('Auth authorize error', {
            module: 'auth',
            error: error instanceof Error ? error.message : String(error),
          })
          return null
        }
      },
    }),
  ],
})
