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
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, ShieldCheck } from 'lucide-react'
import { formatPhone } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'

interface Supplier {
  id: string
  partnerCode: string
  partnerName: string
  businessNo: string
  ceoName: string
  phone: string
  haccpCertNo: string | null
  foodLicenseNo: string | null
  isActive: boolean
}

const columns: ColumnDef<Supplier>[] = [
  {
    accessorKey: 'partnerCode',
    header: '매입처코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.partnerCode}</span>,
  },
  {
    accessorKey: 'partnerName',
    header: '매입처명',
    cell: ({ row }) => <span className="font-medium">{row.original.partnerName}</span>,
  },
  {
    accessorKey: 'businessNo',
    header: '사업자번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.businessNo || '-'}</span>,
  },
  {
    accessorKey: 'ceoName',
    header: '대표자',
    cell: ({ row }) => row.original.ceoName || '-',
  },
  {
    accessorKey: 'phone',
    header: '연락처',
    cell: ({ row }) => formatPhone(row.original.phone) || '-',
  },
  {
    id: 'haccp',
    header: 'HACCP인증',
    cell: ({ row }) =>
      row.original.haccpCertNo ? (
        <Badge variant="outline" className="border-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          <ShieldCheck className="mr-1 h-3 w-3" />
          인증
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs">미인증</span>
      ),
  },
  {
    id: 'status',
    header: '활성',
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
        {row.original.isActive ? '활성' : '비활성'}
      </Badge>
    ),
  },
]

function SupplierForm({
  supplier,
  onSubmit,
  isPending,
}: {
  supplier?: Supplier | null
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isPending: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            매입처코드 <span className="text-destructive">*</span>
          </Label>
          <Input
            name="partnerCode"
            required
            defaultValue={supplier?.partnerCode || ''}
            disabled={!!supplier}
            className={supplier ? 'bg-muted' : ''}
            placeholder="SUP-001"
          />
        </div>
        <div className="space-y-2">
          <Label>
            매입처명 <span className="text-destructive">*</span>
          </Label>
          <Input name="partnerName" required defaultValue={supplier?.partnerName || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>사업자번호</Label>
          <Input name="businessNo" defaultValue={supplier?.businessNo || ''} placeholder="000-00-00000" />
        </div>
        <div className="space-y-2">
          <Label>대표자</Label>
          <Input name="ceoName" defaultValue={supplier?.ceoName || ''} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>연락처</Label>
          <Input name="phone" defaultValue={supplier?.phone || ''} placeholder="010-0000-0000" />
        </div>
      </div>
      <div className="border-t pt-4">
        <p className="text-muted-foreground mb-3 text-xs font-medium">식품 인허가 정보</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>식품제조업 허가번호</Label>
            <Input name="foodLicenseNo" defaultValue={supplier?.foodLicenseNo || ''} placeholder="제0000-0000호" />
          </div>
          <div className="space-y-2">
            <Label>HACCP 인증번호</Label>
            <Input name="haccpCertNo" defaultValue={supplier?.haccpCertNo || ''} placeholder="HACCP-0000-0000" />
          </div>
        </div>
      </div>
      {supplier && (
        <div className="flex items-center gap-2">
          <Label>활성 상태</Label>
          <Switch name="isActive" defaultChecked={supplier.isActive} />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (supplier ? '수정 중...' : '등록 중...') : supplier ? '수정' : '등록'}
      </Button>
    </form>
  )
}

export default function SuppliersPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['purchasing-suppliers'],
    queryFn: () => api.get('/partners?partnerType=PURCHASE&isActive=true'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/partners', { ...body, partnerType: 'PURCHASE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-suppliers'] })
      setOpen(false)
      toast.success('매입처가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/partners/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchasing-suppliers'] })
      setEditTarget(null)
      toast.success('매입처 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      partnerCode: form.get('partnerCode'),
      partnerName: form.get('partnerName'),
      businessNo: form.get('businessNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      phone: form.get('phone') || undefined,
      foodLicenseNo: form.get('foodLicenseNo') || undefined,
      haccpCertNo: form.get('haccpCertNo') || undefined,
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      partnerName: form.get('partnerName'),
      businessNo: form.get('businessNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      phone: form.get('phone') || undefined,
      foodLicenseNo: form.get('foodLicenseNo') || undefined,
      haccpCertNo: form.get('haccpCertNo') || undefined,
      isActive: form.get('isActive') === 'on',
    })
  }

  const items = (data?.data || []) as Supplier[]

  const exportColumns: ExportColumn[] = [
    { header: '매입처코드', accessor: 'partnerCode' },
    { header: '매입처명', accessor: 'partnerName' },
    { header: '사업자번호', accessor: (r) => r.businessNo || '-' },
    { header: '대표자', accessor: (r) => r.ceoName || '-' },
    { header: '연락처', accessor: (r) => formatPhone(r.phone) || '-' },
    { header: 'HACCP인증', accessor: (r) => r.haccpCertNo ? '인증' : '미인증' },
    { header: '활성', accessor: (r) => r.isActive ? '활성' : '비활성' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '매입처관리', title: '매입처 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="매입처관리"
        description="매입처 정보를 등록하고 관리합니다"
        actions={
          <PermissionGuard module="purchasing" action="create">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> 매입처 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>매입처 등록</DialogTitle>
                </DialogHeader>
                <SupplierForm onSubmit={handleCreate} isPending={createMutation.isPending} />
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
              <PermissionGuard module="purchasing" action="update">
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
        searchPlaceholder="매입처명, 사업자번호 검색..."
        searchColumn="partnerName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />

      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>매입처 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <SupplierForm
              key={editTarget.id}
              supplier={editTarget}
              onSubmit={handleUpdate}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
