'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/format'

interface SettlementRow {
  id: string
  companyName: string
  period: string
  totalOrders: number
  totalShippingCost: number
  totalSurcharge: number
  totalAmount: number
  status: string
}

const columns: ColumnDef<SettlementRow>[] = [
  {
    accessorKey: 'companyName',
    header: '화주사',
    cell: ({ row }) => <span className="font-medium">{row.original.companyName}</span>,
  },
  {
    accessorKey: 'period',
    header: '정산기간',
    cell: ({ row }) => row.original.period || '-',
  },
  {
    accessorKey: 'totalOrders',
    header: '주문건수',
    cell: ({ row }) => row.original.totalOrders?.toLocaleString() || '0',
  },
  {
    id: 'totalShippingCost',
    header: '배송비',
    cell: ({ row }) => formatCurrency(row.original.totalShippingCost),
  },
  {
    id: 'totalSurcharge',
    header: '부가요금',
    cell: ({ row }) => formatCurrency(row.original.totalSurcharge),
  },
  {
    id: 'totalAmount',
    header: '합계',
    cell: ({ row }) => <span className="font-bold">{formatCurrency(row.original.totalAmount)}</span>,
  },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === 'CONFIRMED' ? 'default' : 'secondary'}
        className={
          row.original.status === 'CONFIRMED' ? 'bg-green-500 hover:bg-green-600' : 'bg-yellow-500 hover:bg-yellow-600'
        }
      >
        {row.original.status === 'CONFIRMED' ? '확정' : '정산중'}
      </Badge>
    ),
  },
]

export default function SettlementPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-settlement', startDate, endDate],
    queryFn: () => api.get(`/sales/3pl/settlement?${qp.toString()}`) as Promise<{ data: SettlementRow[] }>,
  })

  const settlements: SettlementRow[] = data?.data || []

  const totalAmount = settlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
  const totalOrders = settlements.reduce((sum, s) => sum + (s.totalOrders || 0), 0)
  const uniqueShippers = new Set(settlements.map((s) => s.companyName)).size

  return (
    <div className="space-y-6">
      <PageHeader title="정산관리" description="화주사별 배송비 정산을 관리합니다" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">총 정산액</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">총 주문건수</p>
          <p className="text-2xl font-bold">{totalOrders.toLocaleString()}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">화주사 수</p>
          <p className="text-2xl font-bold">{uniqueShippers}사</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="w-full sm:w-36"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="시작일"
        />
        <span className="text-muted-foreground text-xs">~</span>
        <Input
          type="date"
          className="w-full sm:w-36"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="종료일"
        />
      </div>

      <DataTable
        columns={columns}
        data={settlements}
        searchColumn="companyName"
        searchPlaceholder="화주사명으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />
    </div>
  )
}
