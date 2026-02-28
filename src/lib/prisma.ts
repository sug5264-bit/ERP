import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 느린 쿼리 임계값 (ms)
const SLOW_QUERY_THRESHOLD = Number(process.env.SLOW_QUERY_THRESHOLD) || 200

// 쿼리 성능 통계 (운영 모니터링용)
interface QueryStats {
  totalQueries: number
  slowQueries: number
  errorCount: number
  avgDuration: number
  maxDuration: number
  lastReset: number
}

const queryStats: QueryStats = {
  totalQueries: 0,
  slowQueries: 0,
  errorCount: 0,
  avgDuration: 0,
  maxDuration: 0,
  lastReset: Date.now(),
}

/** 쿼리 성능 통계 조회 (헬스체크/모니터링 API에서 사용) */
export function getQueryStats(): QueryStats & { uptimeMinutes: number } {
  return {
    ...queryStats,
    uptimeMinutes: Math.round((Date.now() - queryStats.lastReset) / 60_000),
  }
}

/** 통계 초기화 */
export function resetQueryStats(): void {
  queryStats.totalQueries = 0
  queryStats.slowQueries = 0
  queryStats.errorCount = 0
  queryStats.avgDuration = 0
  queryStats.maxDuration = 0
  queryStats.lastReset = Date.now()
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
        : [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
          ],
  })

  // 쿼리 성능 모니터링 (개발 + 프로덕션)
  ;(client as unknown as { $on: (event: string, cb: (e: { duration: number; query?: string }) => void) => void }).$on(
    'query',
    (e) => {
      const duration = e.duration
      queryStats.totalQueries++

      // 이동 평균 계산
      queryStats.avgDuration = queryStats.avgDuration + (duration - queryStats.avgDuration) / queryStats.totalQueries
      if (duration > queryStats.maxDuration) {
        queryStats.maxDuration = duration
      }

      if (duration > SLOW_QUERY_THRESHOLD) {
        queryStats.slowQueries++
        console.warn(
          JSON.stringify({
            level: 'warn',
            type: 'SLOW_QUERY',
            duration: `${duration}ms`,
            query: e.query?.slice(0, 200),
            timestamp: new Date().toISOString(),
          })
        )
      }
    }
  )

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 개발 환경: 핫 리로드 시 클라이언트 재생성 방지
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
