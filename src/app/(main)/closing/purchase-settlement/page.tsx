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
import { FileSpreadsheet, DollarSign, Wallet, AlertCircle } from 'lucide-react'

const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  COMPLETED: '정산완료',
  PARTIAL: '부분지급',
  PENDING: '미지급',
}

interface PurchaseSettlement {
  id: string
  supplierName: string
  purchaseCount: number
  purchaseAmount: number
  paidAmount: number
  unpaidAmount: number
  status: string
}

const columns: ColumnDef<PurchaseSettlement>[] = [
  {
    accessorKey: 'supplierName',
    header: '매입처명',
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
    accessorKey: 'paidAmount',
    header: '지급액',
    cell: ({ row }) => <span className="text-green-600 tabular-nums">{formatCurrency(row.original.paidAmount)}</span>,
  },
  {
    accessorKey: 'unpaidAmount',
    header: '미지급액',
    cell: ({ row }) => (
      <span className={`tabular-nums ${row.original.unpaidAmount > 0 ? 'font-medium text-red-600' : ''}`}>
        {formatCurrency(row.original.unpaidAmount)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: '정산상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={SETTLEMENT_STATUS_LABELS} />,
  },
]

export default function PurchaseSettlementPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['closing-purchase-settlement', startDate, endDate],
    queryFn: () => api.get(`/closing/purchase-settlement?${qp.toString()}`),
  })

  const items = (data?.data || []) as PurchaseSettlement[]

  const totalPurchase = items.reduce((sum, i) => sum + (i.purchaseAmount || 0), 0)
  const totalPaid = items.reduce((sum, i) => sum + (i.paidAmount || 0), 0)
  const totalUnpaid = items.reduce((sum, i) => sum + (i.unpaidAmount || 0), 0)

  const summaryItems = [
    {
      label: '총매입',
      value: `${formatCurrency(totalPurchase)}`,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: '총지급',
      value: `${formatCurrency(totalPaid)}`,
      icon: Wallet,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: '총미지급',
      value: `${formatCurrency(totalUnpaid)}`,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="매입정산" description="매입 정산 내역을 조회하고 관리합니다" />

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
        searchPlaceholder="매입처명 검색..."
        searchColumn="supplierName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
