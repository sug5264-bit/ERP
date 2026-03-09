import { describe, it, expect, beforeEach } from 'vitest'
import { cached, invalidateCache, clearCache } from '@/lib/cache'

describe('Server-side Cache', () => {
  beforeEach(() => {
    clearCache()
  })

  it('첫 호출 시 fetcher를 실행하고 결과를 캐싱', async () => {
    let callCount = 0
    const fetcher = async () => {
      callCount++
      return { items: ['a', 'b'] }
    }

    const first = await cached('test-key', fetcher)
    const second = await cached('test-key', fetcher)

    expect(first).toEqual({ items: ['a', 'b'] })
    expect(second).toEqual({ items: ['a', 'b'] })
    expect(callCount).toBe(1) // fetcher는 한 번만 호출
  })

  it('TTL 만료 후 fetcher를 재실행', async () => {
    let callCount = 0
    const fetcher = async () => ++callCount

    await cached('ttl-key', fetcher, 1) // 1ms TTL
    await new Promise((r) => setTimeout(r, 10)) // 만료 대기
    const result = await cached('ttl-key', fetcher, 1)

    expect(result).toBe(2) // 재실행됨
    expect(callCount).toBe(2)
  })

  it('invalidateCache로 특정 키 제거', async () => {
    let callCount = 0
    const fetcher = async () => ++callCount

    await cached('inv-key', fetcher)
    invalidateCache('inv-key')
    const result = await cached('inv-key', fetcher)

    expect(result).toBe(2) // 캐시 미스로 재실행
  })

  it('invalidateCache 와일드카드로 패턴 제거', async () => {
    let call1 = 0,
      call2 = 0
    await cached('items:list:1', async () => ++call1)
    await cached('items:list:2', async () => ++call2)

    invalidateCache('items:*')

    await cached('items:list:1', async () => ++call1)
    await cached('items:list:2', async () => ++call2)

    expect(call1).toBe(2)
    expect(call2).toBe(2)
  })

  it('clearCache로 전체 초기화', async () => {
    let callCount = 0
    await cached('c1', async () => ++callCount)
    await cached('c2', async () => ++callCount)

    clearCache()

    await cached('c1', async () => ++callCount)
    await cached('c2', async () => ++callCount)

    expect(callCount).toBe(4) // 전부 재실행
  })

  it('서로 다른 키는 독립적으로 캐싱', async () => {
    const result1 = await cached('key-a', async () => 'alpha')
    const result2 = await cached('key-b', async () => 'beta')

    expect(result1).toBe('alpha')
    expect(result2).toBe('beta')
  })

  it('fetcher 에러 시 캐시에 저장하지 않음', async () => {
    let callCount = 0
    const failFetcher = async () => {
      callCount++
      if (callCount === 1) throw new Error('fail')
      return 'success'
    }

    await expect(cached('err-key', failFetcher)).rejects.toThrow('fail')
    const result = await cached('err-key', failFetcher)
    expect(result).toBe('success')
    expect(callCount).toBe(2)
  })
})
