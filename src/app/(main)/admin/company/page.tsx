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
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface CompanyRow {
  id: string
  companyName: string
  bizNo: string | null
  ceoName: string | null
  bizType: string | null
  bizCategory: string | null
  address: string | null
  phone: string | null
  fax: string | null
  email: string | null
  bankName: string | null
  bankAccount: string | null
  bankHolder: string | null
  isDefault: boolean
}

export default function CompanyManagementPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => api.get('/admin/company') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/admin/company', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      setCreateOpen(false)
      toast.success('회사 정보가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => api.put(`/admin/company/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      setEditTarget(null)
      toast.success('회사 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/company/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-companies'] })
      toast.success('회사 정보가 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      companyName: form.get('companyName'),
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      bizType: form.get('bizType') || undefined,
      bizCategory: form.get('bizCategory') || undefined,
      address: form.get('address') || undefined,
      phone: form.get('phone') || undefined,
      fax: form.get('fax') || undefined,
      email: form.get('email') || undefined,
      bankName: form.get('bankName') || undefined,
      bankAccount: form.get('bankAccount') || undefined,
      bankHolder: form.get('bankHolder') || undefined,
      isDefault: form.get('isDefault') === 'on',
    })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      companyName: form.get('companyName'),
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      bizType: form.get('bizType') || undefined,
      bizCategory: form.get('bizCategory') || undefined,
      address: form.get('address') || undefined,
      phone: form.get('phone') || undefined,
      fax: form.get('fax') || undefined,
      email: form.get('email') || undefined,
      bankName: form.get('bankName') || undefined,
      bankAccount: form.get('bankAccount') || undefined,
      bankHolder: form.get('bankHolder') || undefined,
      isDefault: form.get('isDefault') === 'on',
    })
  }

  const companies: CompanyRow[] = data?.data || []

  const columns: ColumnDef<CompanyRow>[] = [
    {
      accessorKey: 'companyName',
      header: '회사명',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.companyName}</span>
          {row.original.isDefault && <Badge variant="default">기본</Badge>}
        </div>
      ),
    },
    { accessorKey: 'bizNo', header: '사업자등록번호', cell: ({ row }) => row.original.bizNo || '-' },
    { accessorKey: 'ceoName', header: '대표자', cell: ({ row }) => row.original.ceoName || '-' },
    { accessorKey: 'phone', header: '전화번호', cell: ({ row }) => row.original.phone || '-' },
    { accessorKey: 'bankName', header: '은행', cell: ({ row }) => row.original.bankName || '-' },
    { accessorKey: 'bankAccount', header: '계좌번호', cell: ({ row }) => row.original.bankAccount || '-' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditTarget(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget({ id: row.original.id, name: row.original.companyName })}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      size: 80,
    },
  ]

  const CompanyForm = ({ onSubmit, defaults, isPending, submitLabel }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; defaults?: CompanyRow | null; isPending: boolean; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>회사명 *</Label>
          <Input name="companyName" required defaultValue={defaults?.companyName || ''} />
        </div>
        <div className="space-y-2">
          <Label>사업자등록번호</Label>
          <Input name="bizNo" placeholder="000-00-00000" defaultValue={defaults?.bizNo || ''} />
        </div>
        <div className="space-y-2">
          <Label>대표자</Label>
          <Input name="ceoName" defaultValue={defaults?.ceoName || ''} />
        </div>
        <div className="space-y-2">
          <Label>업태</Label>
          <Input name="bizType" defaultValue={defaults?.bizType || ''} />
        </div>
        <div className="space-y-2">
          <Label>업종</Label>
          <Input name="bizCategory" defaultValue={defaults?.bizCategory || ''} />
        </div>
        <div className="space-y-2">
          <Label>전화번호</Label>
          <Input name="phone" defaultValue={defaults?.phone || ''} />
        </div>
        <div className="space-y-2">
          <Label>팩스</Label>
          <Input name="fax" defaultValue={defaults?.fax || ''} />
        </div>
        <div className="space-y-2">
          <Label>이메일</Label>
          <Input name="email" type="email" defaultValue={defaults?.email || ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>주소</Label>
          <Input name="address" defaultValue={defaults?.address || ''} />
        </div>
        <div className="space-y-2">
          <Label>은행명</Label>
          <Input name="bankName" defaultValue={defaults?.bankName || ''} />
        </div>
        <div className="space-y-2">
          <Label>계좌번호</Label>
          <Input name="bankAccount" defaultValue={defaults?.bankAccount || ''} />
        </div>
        <div className="space-y-2">
          <Label>예금주</Label>
          <Input name="bankHolder" defaultValue={defaults?.bankHolder || ''} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" name="isDefault" id="isDefault" defaultChecked={defaults?.isDefault || false} className="h-4 w-4" />
          <Label htmlFor="isDefault">기본 회사로 설정</Label>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '처리 중...' : submitLabel}
      </Button>
    </form>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="회사관리" description="회사 정보를 등록하고 관리합니다. 거래명세표, 발주서 작성 시 기본 회사 정보가 연동됩니다." />
      <div className="flex items-center gap-4">
        <Button onClick={() => setCreateOpen(true)}>회사 등록</Button>
      </div>
      <DataTable columns={columns} data={companies} searchColumn="companyName" searchPlaceholder="회사명으로 검색..." isLoading={isLoading} />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>회사 등록</DialogTitle></DialogHeader>
          <CompanyForm onSubmit={handleCreate} isPending={createMutation.isPending} submitLabel="등록" />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>회사 정보 수정</DialogTitle></DialogHeader>
          {editTarget && <CompanyForm key={editTarget.id} onSubmit={handleUpdate} defaults={editTarget} isPending={updateMutation.isPending} submitLabel="수정" />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="회사 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까?`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
