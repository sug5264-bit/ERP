import { format, parseISO, formatDistanceToNow as fDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return '0'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 0,
  }).format(num)
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value == null) return '0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('ko-KR').format(num)
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

export function formatDateKo(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy년 MM월 dd일', { locale: ko })
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  return phone
}

export function formatBizNo(bizNo: string | null | undefined): string {
  if (!bizNo) return ''
  const cleaned = bizNo.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
  }
  return bizNo
}

export function formatDistanceToNow(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  return fDistanceToNow(d, { addSuffix: true, locale: ko })
}

export function validateBizNo(bizNo: string): boolean {
  const cleaned = bizNo.replace(/\D/g, '')
  if (cleaned.length !== 10) return false

  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0

  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * weights[i]
  }

  sum += Math.floor((parseInt(cleaned[8]) * 5) / 10)
  const checkDigit = (10 - (sum % 10)) % 10

  return checkDigit === parseInt(cleaned[9])
}
