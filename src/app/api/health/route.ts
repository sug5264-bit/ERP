import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQueryStats } from '@/lib/prisma'
import { getApiMetrics } from '@/lib/api-helpers'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  uptime: number
  checks: {
    database: { status: string; latencyMs?: number; error?: string }
    memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number; usagePercent: number }
  }
  metrics: {
    api: {
      totalRequests: number
      errorCount: number
      errorRate: string
      avgResponseTimeMs: number
      maxResponseTimeMs: number
    }
    database: {
      totalQueries: number
      slowQueries: number
      avgQueryTimeMs: number
      maxQueryTimeMs: number
    }
  }
}

const startTime = Date.now()

export async function GET() {
  const health: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks: {
      database: { status: 'unknown' },
      memory: { heapUsedMB: 0, heapTotalMB: 0, rssMB: 0, usagePercent: 0 },
    },
    metrics: {
      api: {
        totalRequests: 0,
        errorCount: 0,
        errorRate: '0%',
        avgResponseTimeMs: 0,
        maxResponseTimeMs: 0,
      },
      database: {
        totalQueries: 0,
        slowQueries: 0,
        avgQueryTimeMs: 0,
        maxQueryTimeMs: 0,
      },
    },
  }

  // DB 연결 체크
  try {
    const dbStart = performance.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Math.round(performance.now() - dbStart)
    health.checks.database = { status: 'connected', latencyMs: dbLatency }

    if (dbLatency > 1000) {
      health.status = 'degraded'
      health.checks.database.status = 'slow'
    }
  } catch (error) {
    health.status = 'unhealthy'
    health.checks.database = {
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // 메모리 사용량
  const mem = process.memoryUsage()
  health.checks.memory = {
    heapUsedMB: Math.round(mem.heapUsed / 1048576),
    heapTotalMB: Math.round(mem.heapTotal / 1048576),
    rssMB: Math.round(mem.rss / 1048576),
    usagePercent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
  }

  // 메모리 사용량이 90% 이상이면 degraded
  if (health.checks.memory.usagePercent > 90) {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
  }

  // API 메트릭
  const apiM = getApiMetrics()
  health.metrics.api = {
    totalRequests: apiM.totalRequests,
    errorCount: apiM.errorCount,
    errorRate: apiM.totalRequests > 0 ? `${((apiM.errorCount / apiM.totalRequests) * 100).toFixed(1)}%` : '0%',
    avgResponseTimeMs: Math.round(apiM.avgResponseTime),
    maxResponseTimeMs: Math.round(apiM.maxResponseTime),
  }

  // DB 쿼리 메트릭
  const dbM = getQueryStats()
  health.metrics.database = {
    totalQueries: dbM.totalQueries,
    slowQueries: dbM.slowQueries,
    avgQueryTimeMs: Math.round(dbM.avgDuration),
    maxQueryTimeMs: Math.round(dbM.maxDuration),
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200

  return NextResponse.json(health, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Status': health.status,
    },
  })
}
