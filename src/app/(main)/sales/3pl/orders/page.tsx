'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수',
  PROCESSING: '처리중',
  SHIPPED: '출고',
  IN_TRANSIT: '배송중',
  DELIVERED: '배송완료',
  RETURNED: '반품',
}

const STATUS_COLOR: Record<string, string> = {
  RECEIVED: 'bg-blue-500 hover:bg-blue-600',
  PROCESSING: 'bg-yellow-500 hover:bg-yellow-600',
  SHIPPED: 'bg-purple-500 hover:bg-purple-600',
  IN_TRANSIT: 'bg-orange-500 hover:bg-orange-600',
  DELIVERED: 'bg-green-500 hover:bg-green-600',
  RETURNED: 'bg-red-500 hover:bg-red-600',
}

interface ShipperOption {
  id: string
  companyName: string
}

interface OrderRow {
  id: string
  orderNo: string
  orderDate: string
  shipperId: string
  shipper: { companyName: string }
  recipientName: string
  itemName: string
  quantity: number
  shippingMethod: string
  status: string
  trackingNo: string | null
}

const columns: ColumnDef<OrderRow>[] = [
  {
    accessorKey: 'orderNo',
    header: '주문번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
  },
  {
    accessorKey: 'orderDate',
    header: '주문일',
    cell: ({ row }) => row.original.orderDate?.slice(0, 10) || '-',
  },
  {
    id: 'shipperName',
    header: '화주사',
    cell: ({ row }) => <span className="font-medium">{row.original.shipper?.companyName || '-'}</span>,
  },
  { accessorKey: 'recipientName', header: '수취인' },
  { accessorKey: 'itemName', header: '상품명' },
  {
    accessorKey: 'quantity',
    header: '수량',
    cell: ({ row }) => row.original.quantity?.toLocaleString() || '-',
  },
  { accessorKey: 'shippingMethod', header: '배송방법' },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => (
      <Badge className={STATUS_COLOR[row.original.status] || ''}>
        {STATUS_LABEL[row.original.status] || row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: 'trackingNo',
    header: '운송장번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.trackingNo || '-'}</span>,
  },
]

export default function OrdersPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [shipperFilter, setShipperFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: shippersData } = useQuery({
    queryKey: ['3pl-shippers'],
    queryFn: () => api.get('/sales/3pl/shippers') as Promise<{ data: ShipperOption[] }>,
  })
  const shipperOptions: ShipperOption[] = shippersData?.data || []

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (shipperFilter && shipperFilter !== 'all') qp.set('shipperId', shipperFilter)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-orders', startDate, endDate, shipperFilter, statusFilter],
    queryFn: () => api.get(`/sales/3pl/orders?${qp.toString()}`) as Promise<{ data: OrderRow[] }>,
  })

  const orders: OrderRow[] = data?.data || []

  const statusCounts = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="주문접수 현황" description="화주사 포털에서 접수된 주문을 조회합니다" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border p-3 text-center">
          <p className="text-muted-foreground text-xs">전체</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <div key={key} className="rounded-lg border p-3 text-center">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className="text-2xl font-bold">{statusCounts[key] || 0}</p>
          </div>
        ))}
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
        <Select value={shipperFilter} onValueChange={setShipperFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="전체 화주사" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 화주사</SelectItem>
            {shipperOptions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        searchColumn="orderNo"
        searchPlaceholder="주문번호로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />
    </div>
  )
}
