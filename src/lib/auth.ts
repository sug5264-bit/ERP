import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/rate-limit'
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
        ipAddress: { label: 'IP', type: 'text' }, // 미들웨어에서 주입
      },
      async authorize(credentials) {
        try {
          const username = credentials?.username
          const password = credentials?.password
          const ipAddress = String(credentials?.ipAddress || '0.0.0.0')

          if (!username || !password) {
            logger.warn('Login attempt with missing credentials')
            return null
          }

          const usernameStr = String(username)
          const passwordStr = String(password)

          // DB 기반 Rate limiting: 15분 내 5회 실패 시 차단 (서버리스 인스턴스 간 공유)
          const rateCheck = await checkLoginRateLimit(usernameStr, ipAddress)
          if (!rateCheck.allowed) {
            logger.warn('Login rate limit exceeded', { module: 'auth', action: 'login', username: usernameStr })
            return null
          }

          // Prisma ORM으로 사용자 조회 (스키마 동기화 완료 후 queryRawUnsafe 제거)
          const user = await prisma.user.findUnique({
            where: { username: usernameStr },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              isActive: true,
              employeeId: true,
              accountType: true,
              shipperId: true,
            },
          })

          if (!user) {
            await recordLoginAttempt(usernameStr, ipAddress, false)
            logger.warn('Login failed: user not found', { module: 'auth', action: 'login' })
            return null
          }

          if (!user.isActive) {
            await recordLoginAttempt(usernameStr, ipAddress, false)
            logger.warn('Login failed: user inactive', { module: 'auth', action: 'login', userId: user.id })
            return null
          }

          const isPasswordValid = await compare(passwordStr, user.passwordHash)

          if (!isPasswordValid) {
            await recordLoginAttempt(usernameStr, ipAddress, false)
            logger.warn('Login failed: invalid password', { module: 'auth', action: 'login', userId: user.id })
            return null
          }

          // 로그인 성공 기록 및 마지막 로그인 시각 갱신
          await Promise.all([
            recordLoginAttempt(usernameStr, ipAddress, true),
            prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            }),
          ])

          // 역할 + 권한 조회 (Prisma relations)
          const userWithRoles = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              userRoles: {
                select: {
                  role: {
                    select: {
                      name: true,
                      rolePermissions: {
                        select: {
                          permission: {
                            select: { module: true, action: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          })

          const roles = userWithRoles?.userRoles.map((ur) => ur.role.name) ?? []
          const permissions =
            userWithRoles?.userRoles.flatMap((ur) =>
              ur.role.rolePermissions.map((rp) => ({
                module: rp.permission.module,
                action: rp.permission.action,
              }))
            ) ?? []

          // 직원 정보 조회 (Prisma relations)
          let employeeName: string | null = null
          let departmentName: string | null = null
          let positionName: string | null = null

          if (user.employeeId) {
            const emp = await prisma.employee.findUnique({
              where: { id: user.employeeId },
              select: {
                nameKo: true,
                department: { select: { name: true } },
                position: { select: { name: true } },
              },
            })
            if (emp) {
              employeeName = emp.nameKo
              departmentName = emp.department?.name ?? null
              positionName = emp.position?.name ?? null
            }
          }

          logger.info('Login successful', { module: 'auth', action: 'login', userId: user.id })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            roles,
            permissions,
            employeeId: user.employeeId,
            employeeName,
            departmentName,
            positionName,
            accountType: user.accountType || 'INTERNAL',
            shipperId: user.shipperId,
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
