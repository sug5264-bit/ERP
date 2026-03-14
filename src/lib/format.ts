import { format, parseISO, formatDistanceToNow as fDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return '0원'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (!isFinite(num) || isNaN(num)) return '0원'
  // 문자열 입력 시 숫자 외 문자가 포함된 경우 안전하게 처리
  if (typeof amount === 'string' && amount.trim() !== '' && isNaN(Number(amount))) {
    // parseFloat('123abc') = 123 이므로, Number() 로 엄격 검증하여 불일치 시 0원 반환
    return '0원'
  }
  if (num < 0) {
    return `△${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.abs(num))}원`
  }
  return (
    new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 0,
    }).format(num) + '원'
  )
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (isNaN(d.getTime())) return ''
    return format(d, 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (isNaN(d.getTime())) return ''
    return format(d, 'yyyy-MM-dd HH:mm', { locale: ko })
  } catch {
    return ''
  }
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  // 서울 지역번호 (02-xxxx-xxxx)
  if (cleaned.length === 10 && cleaned.startsWith('02')) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  // 서울 지역번호 9자리 (02-xxx-xxxx)
  if (cleaned.length === 9 && cleaned.startsWith('02')) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  // 대표번호 (1588-xxxx, 1577-xxxx 등)
  if (cleaned.length === 8 && cleaned.startsWith('1')) {
    return cleaned.replace(/(\d{4})(\d{4})/, '$1-$2')
  }
  return phone
}

/** DateTime에서 시간(HH:mm)만 추출 (로컬 타임존 기준) */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (isNaN(d.getTime())) return ''
    return format(d, 'HH:mm')
  } catch {
    return ''
  }
}

/** 로컬 타임존 기준 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
export function getLocalDateString(date?: Date): string {
  return format(date ?? new Date(), 'yyyy-MM-dd')
}

export function formatDistanceToNow(date: string | Date | null | undefined): string {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (isNaN(d.getTime())) return ''
    return fDistanceToNow(d, { addSuffix: true, locale: ko })
  } catch {
    return ''
  }
}
