'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface RevenueRow {
  date: string
  month: string
  totalOrders: number
  totalRevenue: number
  averagePerOrder: number
}

export default function RevenuePage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [groupBy, setGroupBy] = useState('monthly')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  qp.set('groupBy', groupBy)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-revenue', startDate, endDate, groupBy],
    queryFn: () => api.get(`/sales/3pl/revenue?${qp.toString()}`) as Promise<{ data: RevenueRow[] }>,
  })

  const rows: RevenueRow[] = data?.data || []

  const totalRevenue = rows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0)
  const totalOrders = rows.reduce((sum, r) => sum + (r.totalOrders || 0), 0)
  const averagePerOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

  const columns: ColumnDef<RevenueRow>[] = [
    {
      id: 'period',
      header: '기간',
      cell: ({ row }) => (
        <span className="font-medium">{groupBy === 'daily' ? row.original.date : row.original.month}</span>
      ),
    },
    {
      accessorKey: 'totalOrders',
      header: '주문건수',
      cell: ({ row }) => row.original.totalOrders?.toLocaleString() || '0',
    },
    {
      id: 'totalRevenue',
      header: '매출액',
      cell: ({ row }) => <span className="font-bold">{formatCurrency(row.original.totalRevenue)}</span>,
    },
    {
      id: 'averagePerOrder',
      header: '건당평균',
      cell: ({ row }) => formatCurrency(row.original.averagePerOrder),
    },
  ]

  const chartData = rows.map((r) => ({
    name: groupBy === 'daily' ? r.date : r.month,
    매출액: r.totalRevenue,
    주문건수: r.totalOrders,
  }))

  return (
    <div className="space-y-6">
      <PageHeader title="매출현황" description="3PL 배송 매출 현황을 조회합니다" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">총 매출</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">총 주문건수</p>
          <p className="text-2xl font-bold">{totalOrders.toLocaleString()}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">건당 평균</p>
          <p className="text-2xl font-bold">{formatCurrency(averagePerOrder)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
        <Select value={groupBy} onValueChange={setGroupBy}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">일별</SelectItem>
            <SelectItem value="monthly">월별</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-lg border p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} labelStyle={{ fontWeight: 'bold' }} />
              <Bar dataKey="매출액" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />
    </div>
  )
}
