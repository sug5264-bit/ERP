'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { SummaryCards } from '@/components/common/summary-cards'
import { formatCurrency } from '@/lib/format'
import { BarChart3, ShoppingCart, Building2, DollarSign } from 'lucide-react'

interface PurchaseSummaryItem {
  id: string
  supplierName: string
  purchaseCount: number
  purchaseAmount: number
  ratio: number
}

interface PurchaseSummaryData {
  totalAmount: number
  totalCount: number
  supplierCount: number
  items: PurchaseSummaryItem[]
}

const columns: ColumnDef<PurchaseSummaryItem>[] = [
  {
    accessorKey: 'supplierName',
    header: '거래처명',
    cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span>,
  },
  {
    accessorKey: 'purchaseCount',
    header: '매입건수',
    cell: ({ row }) => <span className="tabular-nums">{row.original.purchaseCount}건</span>,
  },
  {
    accessorKey: 'purchaseAmount',
    header: '매입금액',
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.purchaseAmount)}</span>,
  },
  {
    accessorKey: 'ratio',
    header: '비중(%)',
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(row.original.ratio, 100)}%` }} />
        </div>
        <span className="text-xs tabular-nums">{row.original.ratio.toFixed(1)}%</span>
      </div>
    ),
  },
]

export default function PurchasingSummaryPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasing-summary', startDate, endDate],
    queryFn: () => api.get(`/purchasing/summary?${qp.toString()}`),
  })

  const summaryData = (data?.data || {
    totalAmount: 0,
    totalCount: 0,
    supplierCount: 0,
    items: [],
  }) as PurchaseSummaryData
  const items = summaryData.items || []

  const summaryItems = [
    {
      label: '총매입액',
      value: `${formatCurrency(summaryData.totalAmount)}`,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '매입건수',
      value: summaryData.totalCount,
      icon: ShoppingCart,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: '매입처수',
      value: summaryData.supplierCount,
      icon: Building2,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="매입현황" description="매입 현황을 조회하고 분석합니다" />

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
        searchPlaceholder="거래처명 검색..."
        searchColumn="supplierName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
