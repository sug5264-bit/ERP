'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { StatusBadge } from '@/components/common/status-badge'
import { PermissionGuard } from '@/components/common/permission-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ListTree, Plus, Pencil, Eye } from 'lucide-react'

const BOM_STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  ACTIVE: '유효',
  INACTIVE: '비활성',
}

interface BomItem {
  id: string
  bomCode: string
  bomName: string
  productName: string
  version: string
  yieldRate: number
  status: string
  materials?: BomMaterial[]
}

interface BomMaterial {
  id: string
  barcode?: string
  itemName: string
  itemCode: string
  quantity: number
  unit: string
  lossRate: number
}

const columns: ColumnDef<BomItem>[] = [
  {
    accessorKey: 'bomCode',
    header: 'BOM코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.bomCode}</span>,
  },
  {
    accessorKey: 'bomName',
    header: 'BOM명',
    cell: ({ row }) => <span className="font-medium">{row.original.bomName}</span>,
  },
  {
    accessorKey: 'productName',
    header: '완제품명',
  },
  {
    accessorKey: 'version',
    header: '버전',
    cell: ({ row }) => <Badge variant="outline">{row.original.version || 'v1.0'}</Badge>,
  },
  {
    accessorKey: 'yieldRate',
    header: '수율(%)',
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.yieldRate != null ? `${row.original.yieldRate}%` : '-'}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: '상태',
    cell: ({ row }) => <StatusBadge status={row.original.status} labels={BOM_STATUS_LABELS} />,
  },
]

function BomForm({
  bom,
  onSubmit,
  isPending,
}: {
  bom?: BomItem | null
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            BOM코드 <span className="text-destructive">*</span>
          </Label>
          <Input
            name="bomCode"
            required
            defaultValue={bom?.bomCode || ''}
            disabled={!!bom}
            className={bom ? 'bg-muted' : ''}
            placeholder="BOM-001"
          />
        </div>
        <div className="space-y-2">
          <Label>
            BOM명 <span className="text-destructive">*</span>
          </Label>
          <Input name="bomName" required defaultValue={bom?.bomName || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            완제품명 <span className="text-destructive">*</span>
          </Label>
          <Input name="productName" required defaultValue={bom?.productName || ''} />
        </div>
        <div className="space-y-2">
          <Label>버전</Label>
          <Input name="version" defaultValue={bom?.version || 'v1.0'} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>수율 (%)</Label>
          <Input name="yieldRate" type="number" step="0.1" defaultValue={bom?.yieldRate || ''} placeholder="95.0" />
        </div>
        <div className="space-y-2">
          <Label>상태</Label>
          <Select name="status" defaultValue={bom?.status || 'DRAFT'}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BOM_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (bom ? '수정 중...' : '등록 중...') : bom ? '수정' : '등록'}
      </Button>
    </form>
  )
}

export default function BomPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BomItem | null>(null)
  const [detailTarget, setDetailTarget] = useState<BomItem | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['production-bom'],
    queryFn: () => api.get('/production/bom'),
  })

  const { data: detailData } = useQuery({
    queryKey: ['production-bom-detail', detailTarget?.id],
    queryFn: () => api.get(`/production/bom/${detailTarget!.id}`),
    enabled: !!detailTarget,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/production/bom', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-bom'] })
      setOpen(false)
      toast.success('배합표가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/production/bom/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-bom'] })
      setEditTarget(null)
      toast.success('배합표가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      bomCode: form.get('bomCode'),
      bomName: form.get('bomName'),
      productName: form.get('productName'),
      version: form.get('version') || 'v1.0',
      yieldRate: form.get('yieldRate') ? parseFloat(form.get('yieldRate') as string) : undefined,
      status: form.get('status'),
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      bomName: form.get('bomName'),
      productName: form.get('productName'),
      version: form.get('version') || 'v1.0',
      yieldRate: form.get('yieldRate') ? parseFloat(form.get('yieldRate') as string) : undefined,
      status: form.get('status'),
    })
  }

  const items = (data?.data || []) as BomItem[]
  const detailMaterials = ((detailData?.data as BomItem)?.materials || []) as BomMaterial[]

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="배합표(BOM)"
        description="제품별 배합표(BOM)를 등록하고 관리합니다"
        actions={
          <PermissionGuard module="production" action="create">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> BOM 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>배합표 등록</DialogTitle>
                </DialogHeader>
                <BomForm onSubmit={handleCreate} isPending={createMutation.isPending} />
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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDetailTarget(row.original)}
                  aria-label="상세보기"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <PermissionGuard module="production" action="update">
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
              </div>
            ),
            size: 100,
          },
        ]}
        data={items}
        searchPlaceholder="BOM코드, BOM명, 완제품 검색..."
        searchColumn="bomName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>배합표 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <BomForm
              key={editTarget.id}
              bom={editTarget}
              onSubmit={handleUpdate}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(v) => !v && setDetailTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>배합표 상세 - {detailTarget?.bomName}</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">BOM코드:</span> {detailTarget.bomCode}
                </div>
                <div>
                  <span className="text-muted-foreground">완제품:</span> {detailTarget.productName}
                </div>
                <div>
                  <span className="text-muted-foreground">버전:</span> {detailTarget.version}
                </div>
                <div>
                  <span className="text-muted-foreground">수율:</span> {detailTarget.yieldRate}%
                </div>
                <div>
                  <span className="text-muted-foreground">상태:</span>{' '}
                  <StatusBadge status={detailTarget.status} labels={BOM_STATUS_LABELS} />
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="mb-2 text-sm font-medium">원자재 목록</h4>
                {detailMaterials.length > 0 ? (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b">
                          <th className="px-3 py-2 text-left text-xs font-medium">바코드</th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">품목코드</th>
                          <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">내품명</th>
                          <th className="px-3 py-2 text-right text-xs font-medium">수량</th>
                          <th className="px-3 py-2 text-left text-xs font-medium">단위</th>
                          <th className="px-3 py-2 text-right text-xs font-medium">손실율(%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailMaterials.map((m) => (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-mono text-xs font-semibold">{m.barcode || '-'}</td>
                            <td className="text-muted-foreground px-3 py-2 font-mono text-xs">{m.itemCode}</td>
                            <td className="text-muted-foreground px-3 py-2 text-xs">{m.itemName}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{m.quantity}</td>
                            <td className="px-3 py-2">{m.unit}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{m.lossRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">등록된 원자재가 없습니다.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
