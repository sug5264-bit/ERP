'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { SummaryCards } from '@/components/common/summary-cards'
import { formatDate } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Package, AlertTriangle, BarChart3 } from 'lucide-react'

interface ProductionResult {
  id: string
  resultNo: string
  productionDate: string
  planNo: string
  producedQty: number
  defectQty: number
  goodQty: number
  lotNo: string
}

const columns: ColumnDef<ProductionResult>[] = [
  {
    accessorKey: 'resultNo',
    header: '실적번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.resultNo}</span>,
  },
  {
    accessorKey: 'productionDate',
    header: '생산일',
    cell: ({ row }) => formatDate(row.original.productionDate),
  },
  {
    accessorKey: 'planNo',
    header: '계획번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.planNo}</span>,
  },
  {
    accessorKey: 'producedQty',
    header: '생산수량',
    cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.producedQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'defectQty',
    header: '불량수량',
    cell: ({ row }) => (
      <span className={`tabular-nums ${row.original.defectQty > 0 ? 'font-medium text-red-600' : ''}`}>
        {row.original.defectQty?.toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: 'goodQty',
    header: '양품수량',
    cell: ({ row }) => <span className="text-green-600 tabular-nums">{row.original.goodQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'lotNo',
    header: 'LOT번호',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs">
        {row.original.lotNo || '-'}
      </Badge>
    ),
  },
]

export default function ProductionResultPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production-result', startDate, endDate],
    queryFn: () => api.get(`/production/result?${qp.toString()}`),
  })

  const items = (data?.data || []) as ProductionResult[]

  const totalProduced = items.reduce((sum, i) => sum + (i.producedQty || 0), 0)
  const totalDefect = items.reduce((sum, i) => sum + (i.defectQty || 0), 0)
  const defectRate = totalProduced > 0 ? ((totalDefect / totalProduced) * 100).toFixed(1) : '0.0'

  const summaryItems = [
    {
      label: '총생산',
      value: totalProduced.toLocaleString(),
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '총불량',
      value: totalDefect.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    { label: '불량률', value: `${defectRate}%`, icon: BarChart3, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="생산실적" description="생산 실적을 기록하고 조회합니다" />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s)
          setEndDate(e)
        }}
      />

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="실적번호, 계획번호, LOT 검색..."
        searchColumn="resultNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
