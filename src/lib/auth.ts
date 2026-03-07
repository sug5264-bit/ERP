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

          // Raw SQL로 조회 (Prisma 스키마와 DB 스키마 불일치 우회)
          const users = await prisma.$queryRawUnsafe<
            {
              id: string
              email: string | null
              name: string
              passwordHash: string
              isActive: boolean
              employeeId: string | null
            }[]
          >(
            'SELECT "id", "email", "name", "passwordHash", "isActive", "employeeId" FROM "User" WHERE "username" = $1 LIMIT 1',
            usernameStr
          )

          if (users.length === 0) {
            incrementRateLimit(rateLimitKey)
            logger.warn('Login failed: user not found', { module: 'auth', action: 'login' })
            return null
          }

          const user = users[0]

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

          await prisma.$executeRawUnsafe('UPDATE "User" SET "lastLoginAt" = NOW() WHERE "id" = $1', user.id)

          // 역할 조회
          const roleRows = await prisma.$queryRawUnsafe<{ roleName: string }[]>(
            `SELECT r."name" as "roleName" FROM "UserRole" ur JOIN "Role" r ON ur."roleId" = r."id" WHERE ur."userId" = $1`,
            user.id
          )
          const roles = roleRows.map((r) => r.roleName)

          // 권한 조회
          const permRows = await prisma.$queryRawUnsafe<{ module: string; action: string }[]>(
            `SELECT p."module", p."action" FROM "UserRole" ur
             JOIN "RolePermission" rp ON ur."roleId" = rp."roleId"
             JOIN "Permission" p ON rp."permissionId" = p."id"
             WHERE ur."userId" = $1`,
            user.id
          )
          const permissions = permRows.map((p) => ({ module: p.module, action: p.action }))

          // 직원 정보 조회
          let employeeName: string | null = null
          let departmentName: string | null = null
          let positionName: string | null = null
          if (user.employeeId) {
            const empRows = await prisma.$queryRawUnsafe<
              { nameKo: string | null; deptName: string | null; posName: string | null }[]
            >(
              `SELECT e."nameKo", d."name" as "deptName", pos."name" as "posName"
               FROM "Employee" e
               LEFT JOIN "Department" d ON e."departmentId" = d."id"
               LEFT JOIN "Position" pos ON e."positionId" = pos."id"
               WHERE e."id" = $1 LIMIT 1`,
              user.employeeId
            )
            if (empRows.length > 0) {
              employeeName = empRows[0].nameKo
              departmentName = empRows[0].deptName
              positionName = empRows[0].posName
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
            accountType: 'INTERNAL',
            shipperId: null,
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
