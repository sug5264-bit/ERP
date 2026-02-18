const BASE_URL = '/api/v1'

async function request(method: string, url: string, data?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  const options: RequestInit = { method, headers }
  if (data !== undefined) {
    options.body = JSON.stringify(data)
  }

  const res = await fetch(`${BASE_URL}${url}`, options)
  const json = await res.json()

  if (!res.ok) {
    const message = json?.error?.message || '요청 처리 중 오류가 발생했습니다.'
    throw new Error(message)
  }

  return json
}

export const api = {
  get: (url: string) => request('GET', url),
  post: (url: string, data?: any) => request('POST', url, data),
  put: (url: string, data?: any) => request('PUT', url, data),
  patch: (url: string, data?: any) => request('PATCH', url, data),
  delete: (url: string) => request('DELETE', url),
}
