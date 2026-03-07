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
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatCurrency, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ClipboardList, Plus, Loader2, CheckCircle, DollarSign } from 'lucide-react'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'

const ORDER_STATUS_LABELS: Record<string, string> = {
  ORDERED: '발주완료',
  IN_PROGRESS: '진행중',
  COMPLETED: '입고완료',
  CANCELLED: '취소',
}

interface PurchaseOrder {
  id: string
  orderNo: string
  orderDate: string
  supplierName: string
  supplyAmount: number
  totalAmount: number
  status: string
  managerName: string
}

const columns: ColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: 'orderNo',
    header: '발주번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
  },
  {
    accessorKey: 'orderDate',
    header: '발주일',
    cell: ({ row }) => formatDate(row.original.orderDate),
  },
  {
    accessorKey: 'supplierName',
    header: '매입처명',
    cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span>,
  },
  {
    accessorKey: 'supplyAmount',
    header: '공급가액',
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.supplyAmount)}</span>,
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={ORDER_STATUS_LABELS} />,
  },
  {
    accessorKey: 'managerName',
    header: '담당자',
  },
]

export default function PurchasingOrdersPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const qp = new URLSearchParams({ page: '1', pageSize: '50' })
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasing-orders', startDate, endDate, statusFilter],
    queryFn: () => api.get(`/purchasing/orders?${qp.toString()}`),
  })

  const items = (data?.data || []) as PurchaseOrder[]

  const exportColumns: ExportColumn[] = [
    { header: '발주번호', accessor: 'orderNo' },
    { header: '발주일', accessor: (r) => r.orderDate },
    { header: '매입처', accessor: 'supplierName' },
    { header: '공급가액', accessor: (r) => Number(r.supplyAmount) },
    { header: '합계금액', accessor: (r) => Number(r.totalAmount) },
    { header: '상태', accessor: (r) => ORDER_STATUS_LABELS[r.status] || r.status },
    { header: '담당자', accessor: 'managerName' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '발주목록', title: '발주 관리 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const totalCount = items.length
  const inProgressCount = items.filter((i) => i.status === 'IN_PROGRESS').length
  const completedCount = items.filter((i) => i.status === 'COMPLETED').length
  const thisMonthAmount = items
    .filter((i) => {
      const d = new Date(i.orderDate)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum, i) => sum + (i.supplyAmount || 0), 0)

  const summaryItems = [
    { label: '전체', value: totalCount, icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: '진행중', value: inProgressCount, icon: Loader2, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: '완료', value: completedCount, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
    {
      label: '이번달 발주금액',
      value: `${formatCurrency(thisMonthAmount)}`,
      icon: DollarSign,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="발주관리"
        description="원자재 및 부자재 발주를 등록하고 관리합니다"
        actions={
          <PermissionGuard module="purchasing" action="create">
            <Button size="sm" onClick={() => toast.info('발주 등록 기능은 준비 중입니다.')}>
              <Plus className="mr-1.5 h-4 w-4" /> 발주 등록
            </Button>
          </PermissionGuard>
        }
      />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="발주번호, 매입처 검색..."
        searchColumn="orderNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
    </div>
  )
}
