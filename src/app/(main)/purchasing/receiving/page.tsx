'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatDate } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ClipboardCheck } from 'lucide-react'

const RECEIVING_STATUS_LABELS: Record<string, string> = {
  RECEIVED: '입고완료',
  INSPECTED: '검수완료',
  REJECTED: '반품',
}

interface ReceivingItem {
  id: string
  receivingNo: string
  receivingDate: string
  orderNo: string
  supplierName: string
  status: string
  inspectorName: string
}

export default function ReceivingPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasing-receiving', startDate, endDate, statusFilter],
    queryFn: () => api.get(`/purchasing/receiving?${qp.toString()}`),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/purchasing/receiving/${id}/inspect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-receiving'] })
      toast.success('검수가 완료되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const items = (data?.data || []) as ReceivingItem[]

  const exportColumns: ExportColumn[] = [
    { header: '입고번호', accessor: 'receivingNo' },
    { header: '입고일', accessor: (r) => formatDate(r.receivingDate) },
    { header: '발주번호', accessor: 'orderNo' },
    { header: '매입처명', accessor: 'supplierName' },
    { header: '상태', accessor: (r) => RECEIVING_STATUS_LABELS[r.status] || r.status },
    { header: '검수자', accessor: (r) => r.inspectorName || '-' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '입고관리', title: '입고관리 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const columns: ColumnDef<ReceivingItem>[] = [
    {
      accessorKey: 'receivingNo',
      header: '입고번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.receivingNo}</span>,
    },
    {
      accessorKey: 'receivingDate',
      header: '입고일',
      cell: ({ row }) => formatDate(row.original.receivingDate),
    },
    {
      accessorKey: 'orderNo',
      header: '발주번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
    },
    {
      accessorKey: 'supplierName',
      header: '매입처명',
      cell: ({ row }) => <span className="font-medium">{row.original.supplierName}</span>,
    },
    {
      accessorKey: 'status',
      header: '상태',
      cell: ({ row }) => <StatusBadge status={row.original.status} labels={RECEIVING_STATUS_LABELS} />,
    },
    {
      accessorKey: 'inspectorName',
      header: '검수자',
      cell: ({ row }) => row.original.inspectorName || '-',
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'RECEIVED' ? (
          <PermissionGuard module="purchasing" action="update">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => confirmMutation.mutate(row.original.id)}
              disabled={confirmMutation.isPending}
            >
              <ClipboardCheck className="mr-1 h-3.5 w-3.5" />
              검수확인
            </Button>
          </PermissionGuard>
        ) : null,
      size: 100,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="입고관리"
        description="발주 입고 현황을 확인하고 검수를 처리합니다"
      />

      <div className="flex flex-wrap items-end gap-2">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => { setStartDate(s); setEndDate(e) }}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            {Object.entries(RECEIVING_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="입고번호, 발주번호, 매입처 검색..."
        searchColumn="receivingNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
    </div>
  )
}
