import { format, parseISO, formatDistanceToNow as fDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return '0'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return '0'
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM-dd HH:mm', { locale: ko })
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

/** 로컬 타임존 기준 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
export function getLocalDateString(date?: Date): string {
  return format(date ?? new Date(), 'yyyy-MM-dd')
}

export function formatDistanceToNow(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return fDistanceToNow(d, { addSuffix: true, locale: ko })
}
