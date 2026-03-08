'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  // 공통
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  ORDERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  PROCESSING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  SHIPPED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  DELIVERED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  CLOSED: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  PREPARING: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  RECEIVED: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  RETURNED: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  // 생산
  PLANNED: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  // OEM
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  TERMINATED: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  // 결재
  DRAFTED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  // 품질
  PASS: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  CONDITIONAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  CONDITIONAL_PASS: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  // BOM
  INACTIVE: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  // 정산
  PARTIAL: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  // 채용
  OPEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  INTERVIEWING: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  HIRED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  // 세금계산서
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  // 기본
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  REQUESTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
}

interface StatusBadgeProps {
  status: string
  labels?: Record<string, string>
  className?: string
}

export function StatusBadge({ status, labels, className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
  const label = labels?.[status] || status

  return (
    <Badge variant="outline" className={cn('border-0 font-medium', colorClass, className)}>
      {label}
    </Badge>
  )
}
