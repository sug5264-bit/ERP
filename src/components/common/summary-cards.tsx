'use client'

import { Card, CardContent } from '@/components/ui/card'
import { type LucideIcon } from 'lucide-react'

interface SummaryItem {
  label: string
  value: string | number
  icon?: LucideIcon
  color?: string  // text-blue-600 등
  bgColor?: string // bg-blue-50 등
}

interface SummaryCardsProps {
  items: SummaryItem[]
  isLoading?: boolean
}

export function SummaryCards({ items, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-3">
        {Array.from({ length: items.length || 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 sm:p-4">
              <div className="skeleton-shimmer h-4 w-16 mb-2" />
              <div className="skeleton-shimmer h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 sm:gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              {item.icon && (
                <div className={`rounded-md p-1 ${item.bgColor || 'bg-muted'}`}>
                  <item.icon className={`h-3.5 w-3.5 ${item.color || 'text-muted-foreground'}`} />
                </div>
              )}
              <p className="text-muted-foreground text-xs">{item.label}</p>
            </div>
            <p className={`text-lg font-bold ${item.color || ''}`}>
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
