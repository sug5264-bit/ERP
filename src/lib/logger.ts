/**
 * 구조화된 로깅 시스템
 * JSON 형식, 트레이스 ID 지원
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  traceId?: string
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
  withContext(context: { traceId?: string; userId?: string; module?: string }) {
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

  generateTraceId,
}
