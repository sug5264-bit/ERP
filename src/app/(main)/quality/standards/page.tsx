'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { PermissionGuard } from '@/components/common/permission-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'

const CATEGORY_OPTIONS = ['미생물', '이화학', '관능', '중금속', '위생'] as const

interface QualityStandard {
  id: string
  barcode?: string
  itemName: string
  standardName: string
  category: string
  testMethod: string
  specification: string
  minValue: number | null
  maxValue: number | null
  isRequired: boolean
}

const columns: ColumnDef<QualityStandard>[] = [
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
    accessorKey: 'standardName',
    header: '기준명',
  },
  {
    accessorKey: 'category',
    header: '카테고리',
    cell: ({ row }) => <Badge variant="outline">{row.original.category || '-'}</Badge>,
  },
  {
    accessorKey: 'testMethod',
    header: '검사방법',
    cell: ({ row }) => <span className="text-xs">{row.original.testMethod || '-'}</span>,
  },
  {
    accessorKey: 'specification',
    header: '규격',
    cell: ({ row }) => row.original.specification || '-',
  },
  {
    accessorKey: 'minValue',
    header: '최소값',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.minValue != null ? row.original.minValue : '-'}</span>
    ),
  },
  {
    accessorKey: 'maxValue',
    header: '최대값',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.maxValue != null ? row.original.maxValue : '-'}</span>
    ),
  },
  {
    id: 'isRequired',
    header: '필수',
    cell: ({ row }) => (
      <Badge variant={row.original.isRequired ? 'default' : 'secondary'}>
        {row.original.isRequired ? '필수' : '선택'}
      </Badge>
    ),
  },
]

function StandardForm({
  standard,
  onSubmit,
  isPending,
}: {
  standard?: QualityStandard | null
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>품목명</Label>
          <Input name="itemName" defaultValue={standard?.itemName || ''} placeholder="선택 입력" />
        </div>
        <div className="space-y-2">
          <Label>
            기준명 <span className="text-destructive">*</span>
          </Label>
          <Input name="standardName" required defaultValue={standard?.standardName || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>카테고리</Label>
          <Select name="category" defaultValue={standard?.category || ''}>
            <SelectTrigger>
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>검사방법</Label>
          <Input name="testMethod" defaultValue={standard?.testMethod || ''} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>규격</Label>
        <Input name="specification" defaultValue={standard?.specification || ''} placeholder="예: 음성, 0.1 이하" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>최소값</Label>
          <Input name="minValue" type="number" step="any" defaultValue={standard?.minValue ?? ''} />
        </div>
        <div className="space-y-2">
          <Label>최대값</Label>
          <Input name="maxValue" type="number" step="any" defaultValue={standard?.maxValue ?? ''} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Label>필수 검사 항목</Label>
        <Switch name="isRequired" defaultChecked={standard?.isRequired ?? true} />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (standard ? '수정 중...' : '등록 중...') : standard ? '수정' : '등록'}
      </Button>
    </form>
  )
}

export default function QualityStandardsPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<QualityStandard | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const queryClient = useQueryClient()

  const qp = new URLSearchParams()
  if (categoryFilter && categoryFilter !== 'all') qp.set('category', categoryFilter)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['quality-standards', categoryFilter],
    queryFn: () => api.get(`/quality/standards?${qp.toString()}`),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/quality/standards', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-standards'] })
      setOpen(false)
      toast.success('검사기준이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/quality/standards/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality-standards'] })
      setEditTarget(null)
      toast.success('검사기준이 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      itemName: form.get('itemName'),
      standardName: form.get('standardName'),
      category: form.get('category') || undefined,
      testMethod: form.get('testMethod') || undefined,
      specification: form.get('specification') || undefined,
      minValue: form.get('minValue') ? parseFloat(form.get('minValue') as string) : undefined,
      maxValue: form.get('maxValue') ? parseFloat(form.get('maxValue') as string) : undefined,
      isRequired: form.get('isRequired') === 'on',
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      itemName: form.get('itemName'),
      standardName: form.get('standardName'),
      category: form.get('category') || undefined,
      testMethod: form.get('testMethod') || undefined,
      specification: form.get('specification') || undefined,
      minValue: form.get('minValue') ? parseFloat(form.get('minValue') as string) : undefined,
      maxValue: form.get('maxValue') ? parseFloat(form.get('maxValue') as string) : undefined,
      isRequired: form.get('isRequired') === 'on',
    })
  }

  const items = (data?.data || []) as QualityStandard[]

  const exportColumns: ExportColumn[] = [
    { header: '바코드', accessor: (r) => r.barcode || '-' },
    { header: '품목명', accessor: 'itemName' },
    { header: '기준명', accessor: 'standardName' },
    { header: '카테고리', accessor: (r) => r.category || '-' },
    { header: '검사방법', accessor: (r) => r.testMethod || '-' },
    { header: '규격', accessor: (r) => r.specification || '-' },
    { header: '최소값', accessor: (r) => (r.minValue != null ? String(r.minValue) : '-') },
    { header: '최대값', accessor: (r) => (r.maxValue != null ? String(r.maxValue) : '-') },
    { header: '필수', accessor: (r) => (r.isRequired ? '필수' : '선택') },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '검사기준', title: '검사기준 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="검사기준"
        description="품질 검사 기준을 등록하고 관리합니다"
        actions={
          <PermissionGuard module="quality" action="create">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> 기준 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>검사기준 등록</DialogTitle>
                </DialogHeader>
                <StandardForm onSubmit={handleCreate} isPending={createMutation.isPending} />
              </DialogContent>
            </Dialog>
          </PermissionGuard>
        }
      />

      <div className="flex flex-wrap items-end gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="전체 카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={[
          ...columns,
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <PermissionGuard module="quality" action="update">
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
        searchPlaceholder="품목명, 기준명 검색..."
        searchColumn="itemName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>검사기준 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <StandardForm
              key={editTarget.id}
              standard={editTarget}
              onSubmit={handleUpdate}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
