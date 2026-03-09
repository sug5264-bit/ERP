'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { SummaryCards } from '@/components/common/summary-cards'
import { formatCurrency, formatDate } from '@/lib/format'
import { Receipt, Package } from 'lucide-react'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

interface Settlement {
  id: string
  period: string
  totalOrders: number
  totalShippingCost: number
  additionalCharges: number
  totalAmount: number
  status: string
  paidAt?: string
}

const columns: ColumnDef<Settlement>[] = [
  { accessorKey: 'period', header: '정산기간' },
  {
    accessorKey: 'totalOrders',
    header: '주문건수',
    cell: ({ row }) => (
      <span className="tabular-nums">{(row.getValue('totalOrders') as number).toLocaleString()}건</span>
    ),
  },
  {
    accessorKey: 'totalShippingCost',
    header: '배송비',
    cell: ({ row }) => (
      <span className="tabular-nums">{formatCurrency(row.getValue('totalShippingCost') as number)}</span>
    ),
  },
  {
    accessorKey: 'additionalCharges',
    header: '부가요금',
    cell: ({ row }) => (
      <span className="tabular-nums">{formatCurrency(row.getValue('additionalCharges') as number)}</span>
    ),
  },
  {
    accessorKey: 'totalAmount',
    header: '합계',
    cell: ({ row }) => (
      <span className="font-semibold tabular-nums">{formatCurrency(row.getValue('totalAmount') as number)}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => {
      const s = row.getValue('status') as string
      const label = s === 'PAID' ? '지급완료' : s === 'CONFIRMED' ? '확정' : '정산중'
      return (
        <span
          className={`text-xs font-medium ${s === 'PAID' ? 'text-green-600' : s === 'CONFIRMED' ? 'text-blue-600' : 'text-yellow-600'}`}
        >
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: 'paidAt',
    header: '지급일',
    cell: ({ row }) => (row.getValue('paidAt') ? formatDate(row.getValue('paidAt') as string) : '-'),
  },
]

export default function ShipperSettlementPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shipper-settlement', startDate, endDate],
    queryFn: () => {
      const qp = new URLSearchParams()
      if (startDate) qp.set('startDate', startDate)
      if (endDate) qp.set('endDate', endDate)
      const qs = qp.toString()
      return api.get(`/shipper/settlement${qs ? `?${qs}` : ''}`)
    },
  })

  const settlements = (data?.data || []) as Settlement[]
  const totalAmount = settlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
  const totalOrders = settlements.reduce((sum, s) => sum + (s.totalOrders || 0), 0)

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="정산내역" description="배송비 정산 내역을 확인하세요" />

        <SummaryCards
          items={[
            {
              label: '총 정산액',
              value: formatCurrency(totalAmount),
              icon: Receipt,
              color: 'text-blue-600',
              bgColor: 'bg-blue-50',
            },
            {
              label: '총 주문건수',
              value: totalOrders,
              icon: Package,
              color: 'text-green-600',
              bgColor: 'bg-green-50',
            },
          ]}
          isLoading={isLoading}
        />

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
          data={settlements}
          searchPlaceholder="정산기간 검색..."
          searchColumn="period"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
        />
      </div>
    </ShipperLayoutShell>
  )
}
