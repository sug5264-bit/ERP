'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { formatDate } from '@/lib/format'
import { INSPECTION_JUDGEMENT_LABELS, QUALITY_GRADE_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchCheck } from 'lucide-react'

interface IncomingInspection {
  id: string
  inspectionNo: string
  inspectionDate: string
  receivingNo: string
  barcode?: string
  itemName: string
  inspectorName: string
  judgement: string
  grade: string
}

const columns: ColumnDef<IncomingInspection>[] = [
  {
    accessorKey: 'inspectionNo',
    header: '검사번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.inspectionNo}</span>,
  },
  {
    accessorKey: 'inspectionDate',
    header: '검사일',
    cell: ({ row }) => formatDate(row.original.inspectionDate),
  },
  {
    accessorKey: 'receivingNo',
    header: '입고번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.receivingNo}</span>,
  },
  {
    accessorKey: 'barcode',
    header: '바코드',
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.barcode || '-'}</span>,
  },
  {
    accessorKey: 'itemName',
    header: '내품명',
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.itemName}</span>,
  },
  {
    accessorKey: 'inspectorName',
    header: '검사자',
  },
  {
    accessorKey: 'judgement',
    header: '판정',
    cell: ({ row }) => <StatusBadge status={row.original.judgement} labels={INSPECTION_JUDGEMENT_LABELS} />,
  },
  {
    accessorKey: 'grade',
    header: '등급',
    cell: ({ row }) => (
      <Badge variant="outline">{QUALITY_GRADE_LABELS[row.original.grade] || row.original.grade || '-'}</Badge>
    ),
  },
]

export default function IncomingInspectionPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [judgementFilter, setJudgementFilter] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (judgementFilter && judgementFilter !== 'all') qp.set('judgement', judgementFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quality-incoming', startDate, endDate, judgementFilter],
    queryFn: () => api.get(`/quality/incoming?${qp.toString()}`),
  })

  const items = (data?.data || []) as IncomingInspection[]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="입고검사" description="입고 물품의 품질 검사를 수행하고 관리합니다" />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <Select value={judgementFilter} onValueChange={setJudgementFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 판정" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 판정</SelectItem>
            {Object.entries(INSPECTION_JUDGEMENT_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="검사번호, 입고번호, 품목 검색..."
        searchColumn="inspectionNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
