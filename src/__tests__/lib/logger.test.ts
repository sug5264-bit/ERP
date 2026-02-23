import { describe, it, expect, vi } from 'vitest'
import { logger } from '@/lib/logger'

describe('Structured Logger', () => {
  it('info 로그가 JSON 형식으로 출력', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.info('Test message', { module: 'test' })
    expect(spy).toHaveBeenCalledOnce()
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.level).toBe('info')
    expect(output.message).toBe('Test message')
    expect(output.module).toBe('test')
    expect(output.timestamp).toBeDefined()
    spy.mockRestore()
  })

  it('error 로그가 console.error로 출력', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('Error occurred', { code: 500 })
    expect(spy).toHaveBeenCalledOnce()
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.level).toBe('error')
    expect(output.message).toBe('Error occurred')
    expect(output.code).toBe(500)
    spy.mockRestore()
  })

  it('warn 로그가 console.warn으로 출력', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('Warning', { detail: 'test' })
    expect(spy).toHaveBeenCalledOnce()
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.level).toBe('warn')
    spy.mockRestore()
  })

  it('withContext가 traceId를 포함한 로거 반환', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ctxLogger = logger.withContext({ userId: 'user-1', module: 'hr' })
    expect(ctxLogger.traceId).toBeDefined()
    ctxLogger.info('Context log')
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.userId).toBe('user-1')
    expect(output.module).toBe('hr')
    expect(output.traceId).toBe(ctxLogger.traceId)
    spy.mockRestore()
  })

  it('withContext에 traceId를 전달하면 해당 ID 사용', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const ctxLogger = logger.withContext({ traceId: 'custom-trace-123' })
    ctxLogger.info('Custom trace')
    const output = JSON.parse(spy.mock.calls[0][0])
    expect(output.traceId).toBe('custom-trace-123')
    spy.mockRestore()
  })
})
