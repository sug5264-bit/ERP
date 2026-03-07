'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { SHIPPER_ORDER_STATUS_LABELS, SHIPPING_METHOD_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PackagePlus } from 'lucide-react'
import Link from 'next/link'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

interface ShipperOrder {
  id: string
  orderNo: string
  orderDate: string
  recipientName: string
  recipientAddress: string
  itemName: string
  quantity: number
  shippingMethod: string
  status: string
  trackingNo?: string
  carrier?: string
  deliveredAt?: string
}

const columns: ColumnDef<ShipperOrder>[] = [
  { accessorKey: 'orderNo', header: '주문번호', cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('orderNo')}</span> },
  { accessorKey: 'orderDate', header: '주문일', cell: ({ row }) => formatDate(row.getValue('orderDate')) },
  { accessorKey: 'recipientName', header: '수취인' },
  { accessorKey: 'itemName', header: '상품명' },
  { accessorKey: 'quantity', header: '수량', cell: ({ row }) => <span className="tabular-nums">{row.getValue('quantity')}</span> },
  { accessorKey: 'shippingMethod', header: '배송방법', cell: ({ row }) => SHIPPING_METHOD_LABELS[row.getValue('shippingMethod') as string] || row.getValue('shippingMethod') },
  { accessorKey: 'status', header: '상태', cell: ({ row }) => <StatusBadge status={row.getValue('status')} labels={SHIPPER_ORDER_STATUS_LABELS} /> },
  { accessorKey: 'trackingNo', header: '운송장번호', cell: ({ row }) => row.getValue('trackingNo') || '-' },
]

export default function ShipperOrdersPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('ALL')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shipper-orders', startDate, endDate, status],
    queryFn: () => api.get(`/shipper/orders?startDate=${startDate}&endDate=${endDate}&status=${status === 'ALL' ? '' : status}`),
  })

  const orders = (data?.data || []) as ShipperOrder[]

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="배송현황" description="주문 및 배송 진행 상태를 확인하세요">
          <Link href="/shipper/orders/new">
            <Button><PackagePlus className="mr-2 h-4 w-4" /> 주문등록</Button>
          </Link>
        </PageHeader>

        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter startDate={startDate} endDate={endDate} onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }} />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              {Object.entries(SHIPPER_ORDER_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={orders}
          searchPlaceholder="주문번호, 수취인 검색..."
          searchColumn="orderNo"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
        />
      </div>
    </ShipperLayoutShell>
  )
}
