'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { StatusBadge } from '@/components/common/status-badge'
import { PermissionGuard } from '@/components/common/permission-guard'
import { formatCurrency, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'

const PRICING_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '유효',
  INACTIVE: '만료',
  DRAFT: '작성중',
}

interface PricingItem {
  id: string
  partnerName: string
  barcode?: string
  itemName: string
  unitPrice: number
  startDate: string
  endDate: string
  minQty: number
  status: string
}

const columns: ColumnDef<PricingItem>[] = [
  {
    accessorKey: 'partnerName',
    header: '거래처명',
    cell: ({ row }) => <span className="font-medium">{row.original.partnerName}</span>,
  },
  {
    accessorKey: 'barcode',
    header: '바코드',
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.barcode || '-'}</span>,
  },
  {
    accessorKey: 'itemName',
    header: '품목명',
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.itemName}</span>,
  },
  {
    accessorKey: 'unitPrice',
    header: '단가',
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.unitPrice)}</span>,
  },
  {
    accessorKey: 'startDate',
    header: '적용시작일',
    cell: ({ row }) => formatDate(row.original.startDate),
  },
  {
    accessorKey: 'endDate',
    header: '적용종료일',
    cell: ({ row }) => formatDate(row.original.endDate),
  },
  {
    accessorKey: 'minQty',
    header: '최소수량',
    cell: ({ row }) => <span className="tabular-nums">{row.original.minQty?.toLocaleString() || '-'}</span>,
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={PRICING_STATUS_LABELS} />,
  },
]

function PricingForm({
  pricing,
  onSubmit,
  isPending,
}: {
  pricing?: PricingItem | null
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            거래처명 <span className="text-destructive">*</span>
          </Label>
          <Input name="partnerName" required defaultValue={pricing?.partnerName || ''} />
        </div>
        <div className="space-y-2">
          <Label>품목명</Label>
          <Input name="itemName" defaultValue={pricing?.itemName || ''} placeholder="선택 입력" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            단가 <span className="text-destructive">*</span>
          </Label>
          <Input name="unitPrice" type="number" required defaultValue={pricing?.unitPrice || ''} />
        </div>
        <div className="space-y-2">
          <Label>최소수량</Label>
          <Input name="minQty" type="number" defaultValue={pricing?.minQty || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            적용시작일 <span className="text-destructive">*</span>
          </Label>
          <Input name="startDate" type="date" required defaultValue={pricing?.startDate?.slice(0, 10) || ''} />
        </div>
        <div className="space-y-2">
          <Label>적용종료일</Label>
          <Input name="endDate" type="date" defaultValue={pricing?.endDate?.slice(0, 10) || ''} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (pricing ? '수정 중...' : '등록 중...') : pricing ? '수정' : '등록'}
      </Button>
    </form>
  )
}

export default function PricingPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PricingItem | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales-pricing'],
    queryFn: () => api.get('/sales/pricing'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/pricing', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pricing'] })
      setOpen(false)
      toast.success('단가가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/sales/pricing/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-pricing'] })
      setEditTarget(null)
      toast.success('단가가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      partnerName: form.get('partnerName'),
      itemName: form.get('itemName'),
      unitPrice: parseFloat(form.get('unitPrice') as string),
      minQty: form.get('minQty') ? parseInt(form.get('minQty') as string) : undefined,
      startDate: form.get('startDate'),
      endDate: form.get('endDate') || undefined,
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      partnerName: form.get('partnerName'),
      itemName: form.get('itemName'),
      unitPrice: parseFloat(form.get('unitPrice') as string),
      minQty: form.get('minQty') ? parseInt(form.get('minQty') as string) : undefined,
      startDate: form.get('startDate'),
      endDate: form.get('endDate') || undefined,
    })
  }

  const items = (data?.data || []) as PricingItem[]

  const exportColumns: ExportColumn[] = [
    { header: '거래처명', accessor: 'partnerName' },
    { header: '바코드', accessor: (r) => r.barcode || '-' },
    { header: '품목명', accessor: 'itemName' },
    { header: '단가', accessor: (r) => formatCurrency(r.unitPrice) },
    { header: '적용시작일', accessor: (r) => formatDate(r.startDate) },
    { header: '적용종료일', accessor: (r) => formatDate(r.endDate) },
    { header: '최소수량', accessor: (r) => r.minQty?.toLocaleString() || '-' },
    { header: '상태', accessor: (r) => PRICING_STATUS_LABELS[r.status] || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '단가관리', title: '단가관리 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="단가관리"
        description="거래처별 품목 단가를 등록하고 관리합니다"
        actions={
          <PermissionGuard module="sales" action="create">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> 단가 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>단가 등록</DialogTitle>
                </DialogHeader>
                <PricingForm onSubmit={handleCreate} isPending={createMutation.isPending} />
              </DialogContent>
            </Dialog>
          </PermissionGuard>
        }
      />

      <DataTable
        columns={[
          ...columns,
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <PermissionGuard module="sales" action="update">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditTarget(row.original)}
                  aria-label="수정"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </PermissionGuard>
            ),
            size: 60,
          },
        ]}
        data={items}
        searchPlaceholder="거래처명, 품목명 검색..."
        searchColumn="partnerName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>단가 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <PricingForm
              key={editTarget.id}
              pricing={editTarget}
              onSubmit={handleUpdate}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
