'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

export interface CalendarEvent {
  id: string
  date: string // YYYY-MM-DD
  label: string
  sublabel?: string
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

interface CalendarViewProps {
  events: CalendarEvent[]
  onDateClick?: (date: string, events: CalendarEvent[]) => void
  onEventClick?: (event: CalendarEvent) => void
  className?: string
  /** Max events to show per cell before showing "+N more" */
  maxEventsPerCell?: number
}

const VARIANT_COLORS: Record<string, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-status-success-muted text-status-success border-status-success/20',
  warning: 'bg-status-warning-muted text-status-warning border-status-warning/20',
  danger: 'bg-status-danger-muted text-status-danger border-status-danger/20',
  info: 'bg-status-info-muted text-status-info border-status-info/20',
}

const VARIANT_DOTS: Record<string, string> = {
  default: 'bg-primary',
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]',
  info: 'bg-[var(--color-info)]',
}

export function CalendarView({
  events,
  onDateClick,
  onEventClick,
  className,
  maxEventsPerCell = 3,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const goToPrev = useCallback(() => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])

  const goToNext = useCallback(() => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  // Build the calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []

    // Previous month fill
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
        isToday: false,
      })
    }

    // Current month
    const today = new Date()
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      days.push({
        date,
        isCurrentMonth: true,
        isToday:
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear(),
      })
    }

    // Next month fill (complete the last week)
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        days.push({
          date: new Date(year, month + 1, d),
          isCurrentMonth: false,
          isToday: false,
        })
      }
    }

    return days
  }, [year, month])

  // Index events by date string
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const evt of events) {
      const key = evt.date
      if (!map[key]) map[key] = []
      map[key].push(evt)
    }
    return map
  }, [events])

  const formatDateKey = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const monthLabel = `${year}년 ${month + 1}월`

  return (
    <div className={cn('rounded-lg border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{monthLabel}</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={goToToday}>
            오늘
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrev} aria-label="이전 달">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNext} aria-label="다음 달">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Day names */}
      <div className="bg-muted/30 grid grid-cols-7 border-b">
        {DAY_NAMES.map((name, i) => (
          <div
            key={name}
            className={cn(
              'px-1 py-2 text-center text-xs font-medium',
              i === 0 && 'text-status-danger',
              i === 6 && 'text-status-info'
            )}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => {
          const dateKey = formatDateKey(day.date)
          const dayEvents = eventsByDate[dateKey] || []
          const dayOfWeek = day.date.getDay()
          const hasEvents = dayEvents.length > 0
          const visibleEvents = dayEvents.slice(0, maxEventsPerCell)
          const moreCount = dayEvents.length - maxEventsPerCell

          return (
            <div
              key={idx}
              className={cn(
                'min-h-[80px] border-r border-b p-1 transition-colors sm:min-h-[100px] sm:p-1.5',
                !day.isCurrentMonth && 'bg-muted/20',
                hasEvents && 'hover:bg-accent/50 cursor-pointer',
                day.isToday && 'bg-primary/5'
              )}
              onClick={() => hasEvents && onDateClick?.(dateKey, dayEvents)}
            >
              {/* Date number */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                    !day.isCurrentMonth && 'text-muted-foreground/50',
                    day.isToday && 'bg-primary text-primary-foreground font-bold',
                    dayOfWeek === 0 && day.isCurrentMonth && !day.isToday && 'text-status-danger',
                    dayOfWeek === 6 && day.isCurrentMonth && !day.isToday && 'text-status-info'
                  )}
                >
                  {day.date.getDate()}
                </span>
                {hasEvents && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {dayEvents.length}
                  </Badge>
                )}
              </div>

              {/* Events */}
              <div className="mt-0.5 space-y-0.5">
                {visibleEvents.map((evt) => (
                  <button
                    key={evt.id}
                    type="button"
                    className={cn(
                      'block w-full truncate rounded border px-1 py-0.5 text-left text-[10px] leading-tight transition-opacity hover:opacity-80 sm:text-[11px]',
                      VARIANT_COLORS[evt.variant || 'default']
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick?.(evt)
                    }}
                    title={evt.sublabel ? `${evt.label} - ${evt.sublabel}` : evt.label}
                  >
                    {evt.label}
                  </button>
                ))}
                {moreCount > 0 && (
                  <p className="text-muted-foreground truncate px-1 text-[10px]">+{moreCount}건 더보기</p>
                )}
              </div>

              {/* Dot indicators for mobile (when no space for labels) */}
              {hasEvents && dayEvents.length > 0 && (
                <div className="mt-0.5 flex gap-0.5 sm:hidden">
                  {dayEvents.slice(0, 4).map((evt, i) => (
                    <span key={i} className={cn('h-1.5 w-1.5 rounded-full', VARIANT_DOTS[evt.variant || 'default'])} />
                  ))}
                  {dayEvents.length > 4 && <span className="text-muted-foreground text-[8px]">+</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
