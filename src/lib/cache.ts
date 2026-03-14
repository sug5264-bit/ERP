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
// 최대 캐시 엔트리 수 (메모리 누수 방지)
const MAX_CACHE_SIZE = 500

/**
 * 만료된 엔트리 정리 + 최대 크기 초과 시 가장 오래된 엔트리 제거
 */
function evictIfNeeded(): void {
  const now = Date.now()
  // 만료된 엔트리 먼저 정리
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key)
  }
  // 그래도 초과하면 가장 오래된 엔트리부터 제거 (Map은 삽입 순서 유지)
  if (store.size > MAX_CACHE_SIZE) {
    const excess = store.size - MAX_CACHE_SIZE
    const keys = store.keys()
    for (let i = 0; i < excess; i++) {
      const { value, done } = keys.next()
      if (done) break // 이터레이터 소진 시 중단
      if (value) store.delete(value)
    }
  }
}

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
  evictIfNeeded()
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

/**
 * 현재 캐시 크기 반환 (모니터링용)
 */
export function getCacheSize(): number {
  return store.size
}
