'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { SHIPPER_ORDER_STATUS_LABELS, SHIPPING_METHOD_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { exportToExcel, type ExportColumn } from '@/lib/export'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PackagePlus, Download } from 'lucide-react'
import Link from 'next/link'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'
import { toast } from 'sonner'

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
  {
    accessorKey: 'orderNo',
    header: '주문번호',
    cell: ({ row }) => (
      <Link href={`/shipper/orders/${row.original.id}`} className="font-mono text-xs text-blue-600 hover:underline">
        {row.getValue('orderNo')}
      </Link>
    ),
  },
  { accessorKey: 'orderDate', header: '주문일', cell: ({ row }) => formatDate(row.getValue('orderDate')) },
  { accessorKey: 'recipientName', header: '수취인' },
  { accessorKey: 'itemName', header: '상품명' },
  {
    accessorKey: 'quantity',
    header: '수량',
    cell: ({ row }) => <span className="tabular-nums">{row.getValue('quantity')}</span>,
  },
  {
    accessorKey: 'shippingMethod',
    header: '배송방법',
    cell: ({ row }) =>
      SHIPPING_METHOD_LABELS[row.getValue('shippingMethod') as string] || row.getValue('shippingMethod'),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.getValue('status')} labels={SHIPPER_ORDER_STATUS_LABELS} />,
  },
  { accessorKey: 'trackingNo', header: '운송장번호', cell: ({ row }) => row.getValue('trackingNo') || '-' },
]

export default function ShipperOrdersPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('ALL')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shipper-orders', startDate, endDate, status],
    queryFn: () =>
      api.get(`/shipper/orders?startDate=${startDate}&endDate=${endDate}&status=${status === 'ALL' ? '' : status}`),
  })

  const orders = (data?.data || []) as ShipperOrder[]

  // Status count badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length }
    for (const order of orders) {
      counts[order.status] = (counts[order.status] || 0) + 1
    }
    return counts
  }, [orders])

  const statusTabs = [
    { key: 'ALL', label: '전체' },
    { key: 'RECEIVED', label: '접수' },
    { key: 'PROCESSING', label: '처리중' },
    { key: 'SHIPPED', label: '배송중' },
    { key: 'DELIVERED', label: '배송완료' },
    { key: 'RETURNED', label: '반품' },
  ]

  const handleExportExcel = async () => {
    if (orders.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.')
      return
    }

    const exportColumns: ExportColumn[] = [
      { header: '주문번호', accessor: 'orderNo' },
      { header: '주문일', accessor: (r) => formatDate(r.orderDate) },
      { header: '수취인', accessor: 'recipientName' },
      { header: '상품명', accessor: 'itemName' },
      { header: '수량', accessor: 'quantity' },
      {
        header: '배송방법',
        accessor: (r) => SHIPPING_METHOD_LABELS[r.shippingMethod as string] || r.shippingMethod,
      },
      { header: '상태', accessor: (r) => SHIPPER_ORDER_STATUS_LABELS[r.status as string] || r.status },
      { header: '운송장번호', accessor: (r) => r.trackingNo || '' },
      { header: '배송업체', accessor: (r) => r.carrier || '' },
    ]

    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`

    await exportToExcel({
      fileName: `배송현황_${dateStr}`,
      title: '배송현황',
      columns: exportColumns,
      data: orders,
    })

    toast.success(`${orders.length}건 엑셀 다운로드 완료`)
  }

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="배송현황"
          description="주문 및 배송 진행 상태를 확인하세요"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download className="mr-2 h-4 w-4" /> 엑셀 다운로드
              </Button>
              <Link href="/shipper/orders/new">
                <Button>
                  <PackagePlus className="mr-2 h-4 w-4" /> 주문등록
                </Button>
              </Link>
            </div>
          }
        />

        {/* Status count badges */}
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Badge
              key={tab.key}
              variant={status === tab.key ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-xs"
              onClick={() => setStatus(tab.key)}
            >
              {tab.label} {statusCounts[tab.key] !== undefined ? `(${statusCounts[tab.key]})` : '(0)'}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => {
              setStartDate(s)
              setEndDate(e)
            }}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              {Object.entries(SHIPPER_ORDER_STATUS_LABELS).map(([k, v]) => (
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
