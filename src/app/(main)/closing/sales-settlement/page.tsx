'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { SummaryCards } from '@/components/common/summary-cards'
import { formatCurrency } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Receipt, DollarSign, CreditCard, AlertCircle } from 'lucide-react'

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  COMPLETED: '정산완료',
  PARTIAL: '부분수금',
  PENDING: '미수금',
}

interface SalesSettlement {
  id: string
  partnerName: string
  salesCount: number
  salesAmount: number
  collectedAmount: number
  outstandingAmount: number
  status: string
}

const columns: ColumnDef<SalesSettlement>[] = [
  {
    accessorKey: 'partnerName',
    header: '거래처명',
    cell: ({ row }) => <span className="font-medium">{row.original.partnerName}</span>,
  },
  {
    accessorKey: 'salesCount',
    header: '매출건수',
    cell: ({ row }) => <span className="tabular-nums">{row.original.salesCount}건</span>,
  },
  {
    accessorKey: 'salesAmount',
    header: '매출금액',
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.salesAmount)}원</span>,
  },
  {
    accessorKey: 'collectedAmount',
    header: '수금액',
    cell: ({ row }) => <span className="tabular-nums text-green-600">{formatCurrency(row.original.collectedAmount)}원</span>,
  },
  {
    accessorKey: 'outstandingAmount',
    header: '미수금액',
    cell: ({ row }) => (
      <span className={`tabular-nums ${row.original.outstandingAmount > 0 ? 'text-red-600 font-medium' : ''}`}>
        {formatCurrency(row.original.outstandingAmount)}원
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: '정산상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={SETTLEMENT_STATUS_LABELS} />,
  },
]

export default function SalesSettlementPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['closing-sales-settlement', startDate, endDate],
    queryFn: () => api.get(`/closing/sales-settlement?${qp.toString()}`),
  })

  const items = (data?.data || []) as SalesSettlement[]

  const totalSales = items.reduce((sum, i) => sum + (i.salesAmount || 0), 0)
  const totalCollected = items.reduce((sum, i) => sum + (i.collectedAmount || 0), 0)
  const totalOutstanding = items.reduce((sum, i) => sum + (i.outstandingAmount || 0), 0)

  const summaryItems = [
    { label: '총매출', value: `${formatCurrency(totalSales)}원`, icon: DollarSign, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: '총수금', value: `${formatCurrency(totalCollected)}원`, icon: CreditCard, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: '총미수금', value: `${formatCurrency(totalOutstanding)}원`, icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="매출정산"
        description="매출 정산 내역을 조회하고 관리합니다"
      />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }}
      />

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="거래처명 검색..."
        searchColumn="partnerName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
