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
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { INSPECTION_JUDGEMENT_LABELS } from '@/lib/constants'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface OutgoingInspection {
  id: string
  inspectionNo: string
  inspectionDate: string
  shipmentNo: string
  barcode?: string
  itemName: string
  sampleCount: number
  defectCount: number
  defectRate: number
  judgement: string
}

const columns: ColumnDef<OutgoingInspection>[] = [
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
    accessorKey: 'shipmentNo',
    header: '출하번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.shipmentNo}</span>,
  },
  {
    accessorKey: 'barcode',
    header: '바코드',
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.barcode || '-'}</span>,
  },
  {
    accessorKey: 'itemName',
    header: '품목명',
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.itemName}</span>,
  },
  {
    accessorKey: 'sampleCount',
    header: '시료수',
    cell: ({ row }) => <span className="tabular-nums">{row.original.sampleCount}</span>,
  },
  {
    accessorKey: 'defectCount',
    header: '불량수',
    cell: ({ row }) => (
      <span className={`tabular-nums ${row.original.defectCount > 0 ? 'font-medium text-red-600' : ''}`}>
        {row.original.defectCount}
      </span>
    ),
  },
  {
    accessorKey: 'defectRate',
    header: '불량률',
    cell: ({ row }) => (
      <span className={`tabular-nums ${row.original.defectRate > 0 ? 'text-red-600' : ''}`}>
        {row.original.defectRate != null ? `${row.original.defectRate.toFixed(1)}%` : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'judgement',
    header: '판정',
    cell: ({ row }) => <StatusBadge status={row.original.judgement} labels={INSPECTION_JUDGEMENT_LABELS} />,
  },
]

export default function OutgoingInspectionPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [judgementFilter, setJudgementFilter] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (judgementFilter && judgementFilter !== 'all') qp.set('judgement', judgementFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quality-outgoing', startDate, endDate, judgementFilter],
    queryFn: () => api.get(`/quality/outgoing?${qp.toString()}`),
  })

  const items = (data?.data || []) as OutgoingInspection[]

  const exportColumns: ExportColumn[] = [
    { header: '검사번호', accessor: 'inspectionNo' },
    { header: '검사일', accessor: (r) => formatDate(r.inspectionDate) },
    { header: '출하번호', accessor: 'shipmentNo' },
    { header: '바코드', accessor: (r) => r.barcode || '-' },
    { header: '품목명', accessor: 'itemName' },
    { header: '시료수', accessor: (r) => Number(r.sampleCount) },
    { header: '불량수', accessor: (r) => Number(r.defectCount) },
    { header: '불량률', accessor: (r) => r.defectRate != null ? `${r.defectRate.toFixed(1)}%` : '-' },
    { header: '판정', accessor: (r) => INSPECTION_JUDGEMENT_LABELS[r.judgement] || r.judgement },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '출하검사', title: '출하검사 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="출하검사" description="출하 물품의 품질 검사를 수행하고 관리합니다" />

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
        searchPlaceholder="검사번호, 출하번호, 품목 검색..."
        searchColumn="inspectionNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
    </div>
  )
}
