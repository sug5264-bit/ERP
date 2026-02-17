/**
 * 입력값 보안 유틸리티
 */

/** HTML 태그 제거 (XSS 방지) */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '')
}

/** 위험한 SQL 패턴 감지 */
export function hasSqlInjection(str: string): boolean {
  const patterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|TABLE|SET|WHERE)\b)/i,
    /(--|;)\s*(DROP|DELETE|ALTER|UPDATE)/i,
    /'\s*(OR|AND)\s*'?\s*\d+\s*=\s*\d+/i,
  ]
  return patterns.some((p) => p.test(str))
}

/** Zod용 안전한 문자열 전처리 (trim + strip HTML) */
export function sanitizeString(str: string): string {
  return stripHtml(str.trim())
}
