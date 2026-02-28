/**
 * 구조화된 로깅 시스템 (대기업 운영용)
 * - JSON 형식 출력 (ELK, CloudWatch 등 로그 수집기 호환)
 * - 트레이스 ID 지원 (분산 추적)
 * - 요청 컨텍스트 자동 전파
 * - 환경별 로그 레벨 제어
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  environment: string
  traceId?: string
  requestId?: string
  userId?: string
  module?: string
  action?: string
  duration?: number
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'] ?? 1
const SERVICE_NAME = process.env.SERVICE_NAME || 'erp-system'
const ENVIRONMENT = process.env.NODE_ENV || 'development'

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry)
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    ...meta,
  }

  const output = formatLog(entry)

  switch (level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.log(output)
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),

  /** API 요청 컨텍스트가 있는 로거 생성 */
  withContext(context: { traceId?: string; requestId?: string; userId?: string; module?: string }) {
    const traceId = context.traceId || generateTraceId()
    return {
      debug: (message: string, meta?: Record<string, unknown>) =>
        log('debug', message, { traceId, ...context, ...meta }),
      info: (message: string, meta?: Record<string, unknown>) => log('info', message, { traceId, ...context, ...meta }),
      warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, { traceId, ...context, ...meta }),
      error: (message: string, meta?: Record<string, unknown>) =>
        log('error', message, { traceId, ...context, ...meta }),
      traceId,
    }
  },

  /** 비즈니스 이벤트 로깅 (감사/컴플라이언스용) */
  audit(event: string, meta: Record<string, unknown>) {
    log('info', event, { type: 'AUDIT', ...meta })
  },

  /** 성능 측정 로깅 */
  perf(operation: string, durationMs: number, meta?: Record<string, unknown>) {
    const level: LogLevel = durationMs > 1000 ? 'warn' : 'info'
    log(level, `Performance: ${operation}`, {
      type: 'PERF',
      operation,
      durationMs,
      ...meta,
    })
  },

  generateTraceId,
}
