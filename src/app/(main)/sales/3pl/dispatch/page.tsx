'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수',
  PROCESSING: '처리중',
  SHIPPED: '출고',
  IN_TRANSIT: '배송중',
}

const STATUS_COLOR: Record<string, string> = {
  RECEIVED: 'bg-blue-500 hover:bg-blue-600',
  PROCESSING: 'bg-yellow-500 hover:bg-yellow-600',
  SHIPPED: 'bg-purple-500 hover:bg-purple-600',
  IN_TRANSIT: 'bg-orange-500 hover:bg-orange-600',
}

interface ShipperOption {
  id: string
  companyName: string
}

interface DispatchRow {
  id: string
  orderNo: string
  shipperId: string
  shipper: { companyName: string }
  recipientName: string
  recipientAddress: string | null
  shippingMethod: string
  status: string
  assignedDriver: string | null
  assignedDriverPhone: string | null
  trackingNo: string | null
  shippingCost: number | null
}

const columns: ColumnDef<DispatchRow>[] = [
  {
    accessorKey: 'orderNo',
    header: '주문번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
  },
  {
    id: 'shipperName',
    header: '화주사',
    cell: ({ row }) => <span className="font-medium">{row.original.shipper?.companyName || '-'}</span>,
  },
  { accessorKey: 'recipientName', header: '수취인' },
  {
    id: 'recipientAddress',
    header: '주소',
    cell: ({ row }) => {
      const addr = row.original.recipientAddress
      if (!addr) return '-'
      return <span title={addr}>{addr.length > 20 ? addr.slice(0, 20) + '...' : addr}</span>
    },
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
    accessorKey: 'assignedDriver',
    header: '배송기사',
    cell: ({ row }) => row.original.assignedDriver || '-',
  },
  {
    accessorKey: 'trackingNo',
    header: '운송장번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.trackingNo || '-'}</span>,
  },
]

export default function DispatchPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [shipperFilter, setShipperFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dispatchTarget, setDispatchTarget] = useState<DispatchRow | null>(null)
  const [selectedRows, setSelectedRows] = useState<DispatchRow[]>([])
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('')
  const queryClient = useQueryClient()

  const { data: shippersData } = useQuery({
    queryKey: ['3pl-shippers'],
    queryFn: () => api.get('/sales/3pl/shippers') as Promise<{ data: ShipperOption[] }>,
  })
  const shipperOptions: ShipperOption[] = shippersData?.data || []

  const qp = new URLSearchParams()
  qp.set('activeOnly', 'true')
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (shipperFilter && shipperFilter !== 'all') qp.set('shipperId', shipperFilter)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-dispatch', startDate, endDate, shipperFilter, statusFilter],
    queryFn: () => api.get(`/sales/3pl/orders?${qp.toString()}`) as Promise<{ data: DispatchRow[] }>,
  })

  const dispatchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put(`/sales/3pl/orders/${body.id}/dispatch`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-dispatch'] })
      queryClient.invalidateQueries({ queryKey: ['3pl-orders'] })
      setDispatchTarget(null)
      toast.success('배차 정보가 저장되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkStatusMutation = useMutation({
    mutationFn: (body: { ids: string[]; status: string }) => api.put('/sales/3pl/orders/bulk-status', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-dispatch'] })
      queryClient.invalidateQueries({ queryKey: ['3pl-orders'] })
      setBulkStatusOpen(false)
      setSelectedRows([])
      toast.success('상태가 일괄 변경되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const orders: DispatchRow[] = data?.data || []

  const handleDispatch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!dispatchTarget) return
    const form = new FormData(e.currentTarget)
    dispatchMutation.mutate({
      id: dispatchTarget.id,
      assignedDriver: form.get('assignedDriver') || undefined,
      assignedDriverPhone: form.get('assignedDriverPhone') || undefined,
      trackingNo: form.get('trackingNo') || undefined,
      status: form.get('status'),
      shippingCost: form.get('shippingCost') ? parseFloat(form.get('shippingCost') as string) : undefined,
    })
  }

  const handleBulkStatus = () => {
    if (!bulkStatus || selectedRows.length === 0) return
    bulkStatusMutation.mutate({
      ids: selectedRows.map((r) => r.id),
      status: bulkStatus,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="배송관제" description="배송 현황을 관리하고 기사를 배정합니다" />

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-full sm:w-36"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-muted-foreground text-xs">~</span>
          <Input type="date" className="w-full sm:w-36" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
        <Button variant="outline" disabled={selectedRows.length === 0} onClick={() => setBulkStatusOpen(true)}>
          상태변경 ({selectedRows.length})
        </Button>
      </div>

      <DataTable
        columns={[
          ...columns,
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <Button variant="outline" size="sm" onClick={() => setDispatchTarget(row.original)}>
                기사배정
              </Button>
            ),
            size: 100,
          },
        ]}
        data={orders}
        searchColumn="orderNo"
        searchPlaceholder="주문번호로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
        selectable
        onSelectionChange={setSelectedRows}
      />

      {/* Dispatch Dialog */}
      <Dialog open={!!dispatchTarget} onOpenChange={(v) => !v && setDispatchTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>배차 / 기사배정</DialogTitle>
          </DialogHeader>
          {dispatchTarget && (
            <form key={dispatchTarget.id} onSubmit={handleDispatch} className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <p>
                  주문번호: <span className="font-mono">{dispatchTarget.orderNo}</span>
                </p>
                <p>수취인: {dispatchTarget.recipientName}</p>
                <p>주소: {dispatchTarget.recipientAddress || '-'}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>배송기사명</Label>
                  <Input name="assignedDriver" defaultValue={dispatchTarget.assignedDriver || ''} />
                </div>
                <div className="space-y-2">
                  <Label>기사 연락처</Label>
                  <Input name="assignedDriverPhone" defaultValue={dispatchTarget.assignedDriverPhone || ''} />
                </div>
                <div className="space-y-2">
                  <Label>운송장번호</Label>
                  <Input name="trackingNo" defaultValue={dispatchTarget.trackingNo || ''} />
                </div>
                <div className="space-y-2">
                  <Label>상태</Label>
                  <Select name="status" defaultValue={dispatchTarget.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                      <SelectItem value="DELIVERED">배송완료</SelectItem>
                      <SelectItem value="RETURNED">반품</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>배송비</Label>
                  <Input name="shippingCost" type="number" defaultValue={dispatchTarget.shippingCost ?? ''} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={dispatchMutation.isPending}>
                {dispatchMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Status Dialog */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>일괄 상태변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">{selectedRows.length}건의 주문 상태를 변경합니다.</p>
            <div className="space-y-2">
              <Label>변경할 상태</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                  <SelectItem value="DELIVERED">배송완료</SelectItem>
                  <SelectItem value="RETURNED">반품</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleBulkStatus}
              disabled={!bulkStatus || bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending ? '변경 중...' : '상태 변경'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
