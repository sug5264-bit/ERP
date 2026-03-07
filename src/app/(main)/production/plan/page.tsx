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
import { formatDate } from '@/lib/format'
import { PRODUCTION_STATUS_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { CalendarClock, Plus, ClipboardList, Loader2, CheckCircle, ListChecks } from 'lucide-react'

interface ProductionPlan {
  id: string
  planNo: string
  planDate: string
  bomName: string
  oemContractName: string | null
  plannedQty: number
  scheduledDate: string
  status: string
}

const columns: ColumnDef<ProductionPlan>[] = [
  {
    accessorKey: 'planNo',
    header: '계획번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.planNo}</span>,
  },
  {
    accessorKey: 'planDate',
    header: '계획일',
    cell: ({ row }) => formatDate(row.original.planDate),
  },
  {
    accessorKey: 'bomName',
    header: '배합표명',
    cell: ({ row }) => <span className="font-medium">{row.original.bomName}</span>,
  },
  {
    accessorKey: 'oemContractName',
    header: 'OEM계약',
    cell: ({ row }) => row.original.oemContractName || '-',
  },
  {
    accessorKey: 'plannedQty',
    header: '계획수량',
    cell: ({ row }) => <span className="tabular-nums">{row.original.plannedQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'scheduledDate',
    header: '예정일',
    cell: ({ row }) => formatDate(row.original.scheduledDate),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={PRODUCTION_STATUS_LABELS} />,
  },
]

export default function ProductionPlanPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production-plan', startDate, endDate, statusFilter],
    queryFn: () => api.get(`/production/plan?${qp.toString()}`),
  })

  const items = (data?.data || []) as ProductionPlan[]

  const totalCount = items.length
  const plannedCount = items.filter(i => i.status === 'PLANNED').length
  const inProgressCount = items.filter(i => i.status === 'IN_PROGRESS').length
  const completedCount = items.filter(i => i.status === 'COMPLETED').length

  const summaryItems = [
    { label: '전체', value: totalCount, icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: '계획', value: plannedCount, icon: ListChecks, color: 'text-violet-600', bgColor: 'bg-violet-50' },
    { label: '진행중', value: inProgressCount, icon: Loader2, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: '완료', value: completedCount, icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50' },
  ]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="생산계획"
        description="생산 계획을 수립하고 관리합니다"
        actions={
          <PermissionGuard module="production" action="create">
            <Button size="sm" onClick={() => toast.info('생산계획 등록 기능은 준비 중입니다.')}>
              <Plus className="mr-1.5 h-4 w-4" /> 계획 등록
            </Button>
          </PermissionGuard>
        }
      />

      <SummaryCards items={summaryItems} isLoading={isLoading} />

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
            {Object.entries(PRODUCTION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="계획번호, 배합표 검색..."
        searchColumn="planNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
