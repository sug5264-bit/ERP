'use client'

import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] || status
  const variant = (STATUS_COLORS[status] || 'secondary') as any

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
