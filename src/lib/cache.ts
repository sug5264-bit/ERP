/**
 * 경량 서버사이드 메모리 캐시
 * 자주 조회되지만 잘 변하지 않는 데이터(거래처/품목/부서 목록 등)에 사용
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

// 기본 TTL: 5분
const DEFAULT_TTL_MS = 5 * 60 * 1000

/**
 * 캐시에서 가져오거나 없으면 fetcher 실행 후 저장
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now()
  const entry = store.get(key) as CacheEntry<T> | undefined

  if (entry && entry.expiresAt > now) {
    return entry.data
  }

  const data = await fetcher()
  store.set(key, { data, expiresAt: now + ttlMs })
  return data
}

/**
 * 특정 키 또는 패턴의 캐시 무효화
 */
export function invalidateCache(keyOrPrefix: string): void {
  if (keyOrPrefix.endsWith('*')) {
    const prefix = keyOrPrefix.slice(0, -1)
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key)
    }
  } else {
    store.delete(keyOrPrefix)
  }
}

/**
 * 전체 캐시 초기화
 */
export function clearCache(): void {
  store.clear()
}
