const BASE_URL = '/api/v1'

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000
const REQUEST_TIMEOUT_MS = 30000

function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes('fetch')) return true
  return false
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Request ID 생성 (클라이언트 → 서버 추적) ───
let clientReqCounter = 0
function generateClientRequestId(): string {
  const ts = Date.now().toString(36)
  const seq = (clientReqCounter++ & 0xffff).toString(36).padStart(3, '0')
  return `c-${ts}-${seq}`
}

// ─── 중복 요청 방지 (Deduplication) ───
const inflightRequests = new Map<string, Promise<any>>()

function getDedupeKey(method: string, url: string): string | null {
  // GET 요청만 중복 제거 (mutation은 항상 실행)
  if (method !== 'GET') return null
  return `${method}:${url}`
}

async function request(method: string, url: string, data?: any) {
  // GET 요청 중복 제거
  const dedupeKey = getDedupeKey(method, url)
  if (dedupeKey) {
    const inflight = inflightRequests.get(dedupeKey)
    if (inflight) return inflight
  }

  const requestId = generateClientRequestId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Request-Id': requestId,
  }

  const body = data !== undefined ? JSON.stringify(data) : undefined

  // 변경 요청(POST/PUT/PATCH/DELETE)은 중복 실행 방지를 위해 재시도하지 않음
  const isMutation = method !== 'GET'
  const maxRetries = isMutation ? 0 : MAX_RETRIES
  let lastError: unknown

  const doRequest = async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(`${BASE_URL}${url}`, {
          method,
          headers,
          signal: controller.signal,
          body,
        })

        // 401 → 세션 만료
        if (res.status === 401) {
          window.location.href = '/login?error=session_expired'
          throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
        }

        // 403 → 권한 없음
        if (res.status === 403) {
          const json = await res.json().catch(() => ({}))
          const message = json?.error?.message || '이 작업에 대한 권한이 없습니다.'
          throw new PermissionError(message)
        }

        // 429 → Rate Limit
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After')
          const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
          clearTimeout(timeoutId)
          throw new RateLimitError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', waitTime)
        }

        const json = await res.json()
        clearTimeout(timeoutId)

        if (!res.ok) {
          let message = json?.error?.message || '요청 처리 중 오류가 발생했습니다.'
          // 유효성 검증 에러: 상세 필드 메시지 포함
          if (json?.error?.code === 'VALIDATION_ERROR' && Array.isArray(json?.error?.details)) {
            const fieldMessages = json.error.details
              .map((d: any) => d.message)
              .filter(Boolean)
              .slice(0, 3)
            if (fieldMessages.length > 0) {
              message = fieldMessages.join(', ')
            }
          }
          throw new ApiError(message, json?.error?.code || 'ERROR', res.status)
        }

        return json
      } catch (error) {
        clearTimeout(timeoutId)
        // AbortError → 타임아웃
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
        }
        lastError = error

        // 권한/비즈니스/Rate Limit 에러는 재시도 불필요
        if (error instanceof PermissionError) throw error
        if (error instanceof RateLimitError) throw error
        if (error instanceof ApiError) throw error
        if (error instanceof Error && !isRetryableError(error)) throw error

        // 네트워크 에러: GET만 재시도 (지수 백오프)
        if (attempt < maxRetries) {
          await wait(RETRY_DELAY_MS * Math.pow(2, attempt))
          continue
        }
      }
    }

    throw lastError || new Error('요청 처리 중 오류가 발생했습니다.')
  }

  // GET 요청 중복 제거: 동일 URL 동시 요청 시 하나만 실행
  if (dedupeKey) {
    const promise = doRequest().finally(() => {
      inflightRequests.delete(dedupeKey)
    })
    inflightRequests.set(dedupeKey, promise)
    return promise
  }

  return doRequest()
}

/**
 * 권한 에러 전용 클래스
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * Rate Limit 에러 클래스
 */
export class RateLimitError extends Error {
  retryAfterMs: number
  constructor(message: string, retryAfterMs: number) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * API 에러 클래스 (에러 코드 포함)
 */
export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export const api = {
  get: (url: string) => request('GET', url),
  post: (url: string, data?: any) => request('POST', url, data),
  put: (url: string, data?: any) => request('PUT', url, data),
  patch: (url: string, data?: any) => request('PATCH', url, data),
  delete: (url: string) => request('DELETE', url),
}
