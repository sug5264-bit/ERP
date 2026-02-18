import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'warn' },
            { emit: 'stdout', level: 'error' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  })

  // 개발 환경: 느린 쿼리 경고 (100ms 이상)
  if (process.env.NODE_ENV === 'development') {
    ;(client as any).$on('query', (e: any) => {
      if (e.duration > 100) {
        console.warn(`[SLOW QUERY] ${e.duration}ms: ${e.query}`)
      }
    })
  }

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 개발 환경: 핫 리로드 시 클라이언트 재생성 방지
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
