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
        try {
          const username = credentials?.username
          const password = credentials?.password

          if (!username || !password) {
            console.error('[Auth] Missing credentials')
            return null
          }

          const usernameStr = String(username)
          const passwordStr = String(password)

          // Rate limiting: 15분 내 5회 실패 시 차단
          const rateLimitKey = `login:${usernameStr}`
          const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000)
          if (!rateCheck.allowed) {
            console.warn(`[Auth] Rate limit exceeded for user: ${usernameStr}`)
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
            console.warn(`[Auth] User not found: ${usernameStr}`)
            return null
          }

          if (!user.isActive) {
            console.warn(`[Auth] User inactive: ${usernameStr}`)
            return null
          }

          const isPasswordValid = await compare(passwordStr, user.passwordHash)

          if (!isPasswordValid) {
            console.warn(`[Auth] Invalid password for user: ${usernameStr}`)
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

          console.log(`[Auth] Login successful: ${usernameStr}`)

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
          console.error('[Auth] Authorize error:', error)
          return null
        }
      },
    }),
  ],
})
