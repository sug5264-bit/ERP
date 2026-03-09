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

/** DB 연결 재시도 (지수 백오프) */
async function connectWithRetry(client: PrismaClient, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.$connect()
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isTransient =
        message.includes('Circuit breaker') ||
        message.includes('connection') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ETIMEDOUT')

      if (!isTransient || attempt === maxRetries) {
        console.error(
          JSON.stringify({
            level: 'error',
            type: 'DB_CONNECTION_FAILED',
            attempt,
            maxRetries,
            error: message.slice(0, 300),
            timestamp: new Date().toISOString(),
          })
        )
        throw error
      }

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000)
      console.warn(
        JSON.stringify({
          level: 'warn',
          type: 'DB_CONNECTION_RETRY',
          attempt,
          nextRetryMs: delayMs,
          error: message.slice(0, 200),
          timestamp: new Date().toISOString(),
        })
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

/** 쿼리 실행 재시도 (Circuit breaker 등 일시적 오류 대응) */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isTransient =
        message.includes('Circuit breaker') ||
        message.includes('Unable to establish connection')

      if (!isTransient || attempt > maxRetries) {
        throw error
      }

      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 4000)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('withRetry: unreachable')
}

function createPrismaClient() {
  // Supabase 서버리스 환경에서 커넥션 풀 제한
  let datasourceUrl = process.env.DATABASE_URL || ''
  if (datasourceUrl && !datasourceUrl.includes('connection_limit')) {
    const separator = datasourceUrl.includes('?') ? '&' : '?'
    datasourceUrl = `${datasourceUrl}${separator}connection_limit=5&pool_timeout=20`
  }

  const client = new PrismaClient({
    datasourceUrl,
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

  // 초기 연결 시도 (비동기, non-blocking)
  connectWithRetry(client).catch(() => {
    // 초기 연결 실패는 로그만 남기고 lazy connection으로 fallback
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 개발 환경: 핫 리로드 시 클라이언트 재생성 방지
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown: 프로세스 종료 시 커넥션 풀 정리
const shutdownHandler = async () => {
  await prisma.$disconnect()
}
process.on('beforeExit', shutdownHandler)
