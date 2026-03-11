import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cached, invalidateCache, clearCache, getCacheSize } from '@/lib/cache'

describe('cache', () => {
  beforeEach(() => {
    clearCache()
  })

  describe('cached', () => {
    it('fetcher 결과를 캐싱하고 반환', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })
      const result1 = await cached('key1', fetcher)
      const result2 = await cached('key1', fetcher)

      expect(result1).toEqual({ data: 'test' })
      expect(result2).toEqual({ data: 'test' })
      expect(fetcher).toHaveBeenCalledTimes(1) // 두 번째 호출은 캐시에서 반환
    })

    it('다른 키는 각각 fetcher 실행', async () => {
      const fetcher1 = vi.fn().mockResolvedValue('data1')
      const fetcher2 = vi.fn().mockResolvedValue('data2')

      const r1 = await cached('key1', fetcher1)
      const r2 = await cached('key2', fetcher2)

      expect(r1).toBe('data1')
      expect(r2).toBe('data2')
      expect(fetcher1).toHaveBeenCalledTimes(1)
      expect(fetcher2).toHaveBeenCalledTimes(1)
    })

    it('TTL 만료 후 fetcher 재실행', async () => {
      vi.useFakeTimers()
      const fetcher = vi.fn().mockResolvedValue('data')

      await cached('key1', fetcher, 1000) // TTL 1초
      expect(fetcher).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1100) // TTL 초과

      await cached('key1', fetcher, 1000)
      expect(fetcher).toHaveBeenCalledTimes(2) // 재실행됨

      vi.useRealTimers()
    })

    it('TTL 이내에는 캐시 반환', async () => {
      vi.useFakeTimers()
      const fetcher = vi.fn().mockResolvedValue('cached-data')

      await cached('key1', fetcher, 5000)
      vi.advanceTimersByTime(3000) // TTL 이내

      const result = await cached('key1', fetcher, 5000)
      expect(result).toBe('cached-data')
      expect(fetcher).toHaveBeenCalledTimes(1) // 캐시에서 반환

      vi.useRealTimers()
    })
  })

  describe('invalidateCache', () => {
    it('특정 키 무효화', async () => {
      const fetcher = vi.fn().mockResolvedValue('data')
      await cached('items:list', fetcher)

      invalidateCache('items:list')

      await cached('items:list', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(2) // 무효화 후 재실행
    })

    it('와일드카드 패턴으로 무효화', async () => {
      const fetcher1 = vi.fn().mockResolvedValue('data1')
      const fetcher2 = vi.fn().mockResolvedValue('data2')
      const fetcher3 = vi.fn().mockResolvedValue('data3')

      await cached('items:list:1', fetcher1)
      await cached('items:list:2', fetcher2)
      await cached('partners:list', fetcher3)

      invalidateCache('items:*')

      await cached('items:list:1', fetcher1)
      await cached('items:list:2', fetcher2)
      await cached('partners:list', fetcher3)

      // items는 재실행, partners는 캐시에서 반환
      expect(fetcher1).toHaveBeenCalledTimes(2)
      expect(fetcher2).toHaveBeenCalledTimes(2)
      expect(fetcher3).toHaveBeenCalledTimes(1)
    })

    it('없는 키 무효화는 무시', () => {
      expect(() => invalidateCache('nonexistent')).not.toThrow()
    })
  })

  describe('clearCache', () => {
    it('전체 캐시 초기화', async () => {
      const fetcher = vi.fn().mockResolvedValue('data')
      await cached('key1', fetcher)
      await cached('key2', fetcher)

      clearCache()

      await cached('key1', fetcher)
      await cached('key2', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(4)
    })
  })

  describe('getCacheSize', () => {
    it('캐시 크기 반환', async () => {
      expect(getCacheSize()).toBe(0)

      await cached('k1', async () => 'v1')
      expect(getCacheSize()).toBe(1)

      await cached('k2', async () => 'v2')
      expect(getCacheSize()).toBe(2)

      clearCache()
      expect(getCacheSize()).toBe(0)
    })
  })
})
