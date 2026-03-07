'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, RotateCcw } from 'lucide-react'

interface DateRangeFilterProps {
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
  className?: string
}

export function DateRangeFilter({ startDate, endDate, onDateChange, className }: DateRangeFilterProps) {
  // 빠른 기간 선택: 오늘, 이번주, 이번달, 이번분기, 올해, 전체
  const presets = [
    { label: '오늘', getValue: () => { const d = today(); return [d, d] } },
    { label: '이번주', getValue: () => { const d = new Date(); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const start = new Date(d); start.setDate(diff); return [fmt(start), fmt(d)] } },
    { label: '이번달', getValue: () => { const d = new Date(); return [fmt(new Date(d.getFullYear(), d.getMonth(), 1)), fmt(d)] } },
    { label: '3개월', getValue: () => { const d = new Date(); const s = new Date(d); s.setMonth(s.getMonth() - 3); return [fmt(s), fmt(d)] } },
    { label: '올해', getValue: () => { const d = new Date(); return [fmt(new Date(d.getFullYear(), 0, 1)), fmt(d)] } },
  ]

  return (
    <div className={`flex flex-wrap items-end gap-2 ${className || ''}`}>
      <div className="space-y-1">
        <Label className="text-xs">시작일</Label>
        <Input type="date" value={startDate} onChange={e => onDateChange(e.target.value, endDate)} className="h-8 w-36 text-sm" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">종료일</Label>
        <Input type="date" value={endDate} onChange={e => onDateChange(startDate, e.target.value)} className="h-8 w-36 text-sm" />
      </div>
      <div className="flex gap-1">
        {presets.map(p => (
          <Button key={p.label} variant="outline" size="sm" className="h-8 text-xs" onClick={() => { const [s, e] = p.getValue(); onDateChange(s, e) }}>
            {p.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onDateChange('', '')} title="초기화">
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function today() { return fmt(new Date()) }
function fmt(d: Date) { return d.toISOString().slice(0, 10) }
