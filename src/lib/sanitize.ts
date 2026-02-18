/**
 * 입력값 살균 유틸리티
 * XSS 및 인젝션 방지를 위한 문자열 처리
 */

/**
 * HTML 특수문자 이스케이프
 * DB 저장 전에 사용자 입력 텍스트에 적용
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * 문자열 입력값 정리
 * - 앞뒤 공백 제거
 * - null 바이트 제거
 * - 연속 공백 정리
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/\0/g, '')           // null 바이트 제거
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // 제어 문자 제거
    .trim()
    .replace(/\s{2,}/g, ' ')     // 연속 공백 → 단일 공백
}

/**
 * 검색 쿼리 살균
 * SQL 와일드카드 및 특수 패턴 제거
 */
export function sanitizeSearchQuery(query: string): string {
  return sanitizeString(query)
    .replace(/[%_\\]/g, (ch) => `\\${ch}`)  // Prisma/SQL 와일드카드 이스케이프
    .slice(0, 100) // 검색어 최대 100자
}

/**
 * 객체의 모든 문자열 필드를 재귀적으로 살균
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result = { ...obj } as Record<string, any>
  for (const key of Object.keys(result)) {
    const value = result[key]
    if (typeof value === 'string') {
      result[key] = sanitizeString(value)
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item: any) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : item !== null && typeof item === 'object'
            ? sanitizeObject(item)
            : item
      )
    }
  }
  return result as T
}

/**
 * 파일명 살균 (업로드 시)
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // 금지 문자 제거
    .replace(/\.\./g, '')                    // 경로 순회 방지
    .trim()
    .slice(0, 255)
}

/**
 * 페이지네이션 파라미터 검증
 */
export function validatePaginationParams(page: unknown, pageSize: unknown) {
  const p = Math.max(1, Math.min(10000, Number(page) || 1))
  const ps = Math.max(1, Math.min(100, Number(pageSize) || 20))
  return { page: p, pageSize: ps }
}
