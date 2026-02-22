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

async function request(method: string, url: string, data?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const options: RequestInit = { method, headers, signal: controller.signal }
  if (data !== undefined) {
    options.body = JSON.stringify(data)
  }

  // 변경 요청(POST/PUT/PATCH/DELETE)은 중복 실행 방지를 위해 재시도하지 않음
  const isMutation = method !== 'GET'
  const maxRetries = isMutation ? 0 : MAX_RETRIES
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${url}`, options)

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

      const json = await res.json()
      clearTimeout(timeoutId)

      if (!res.ok) {
        const message = json?.error?.message || '요청 처리 중 오류가 발생했습니다.'
        throw new Error(message)
      }

      return json
    } catch (error) {
      clearTimeout(timeoutId)
      // AbortError → 타임아웃
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')
      }
      lastError = error

      // 권한 에러나 비즈니스 에러는 재시도 불필요
      if (error instanceof PermissionError) throw error
      if (error instanceof Error && !isRetryableError(error)) throw error

      // 네트워크 에러: GET만 재시도
      if (attempt < maxRetries) {
        await wait(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
    }
  }

  throw lastError || new Error('요청 처리 중 오류가 발생했습니다.')
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

export const api = {
  get: (url: string) => request('GET', url),
  post: (url: string, data?: any) => request('POST', url, data),
  put: (url: string, data?: any) => request('PUT', url, data),
  patch: (url: string, data?: any) => request('PATCH', url, data),
  delete: (url: string) => request('DELETE', url),
}
