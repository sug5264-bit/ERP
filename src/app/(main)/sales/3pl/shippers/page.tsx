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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const CONTRACT_TYPE_MAP: Record<string, string> = {
  STANDARD: '표준',
  PREMIUM: '프리미엄',
  CUSTOM: '커스텀',
}

const CONTRACT_TYPE_VARIANT: Record<string, 'default' | 'destructive' | 'secondary'> = {
  STANDARD: 'default',
  PREMIUM: 'destructive',
  CUSTOM: 'secondary',
}

const PAYMENT_TERMS_MAP: Record<string, string> = {
  PREPAID: '선불',
  POSTPAID: '후불',
}

const BILLING_CYCLE_MAP: Record<string, string> = {
  MONTHLY: '월별',
  BIWEEKLY: '격주',
}

interface ShipperRow {
  id: string
  companyCode: string
  companyName: string
  ceoName: string | null
  bizNo: string | null
  phone: string | null
  email: string | null
  address: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  contractType: string
  paymentTerms: string
  billingCycle: string | null
  contractStart: string | null
  contractEnd: string | null
  memo: string | null
  isActive: boolean
}

const columns: ColumnDef<ShipperRow>[] = [
  {
    accessorKey: 'companyCode',
    header: '회사코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.companyCode}</span>,
  },
  {
    accessorKey: 'companyName',
    header: '회사명',
    cell: ({ row }) => <span className="font-medium">{row.original.companyName}</span>,
  },
  { id: 'ceoName', header: '대표자', cell: ({ row }) => row.original.ceoName || '-' },
  { id: 'bizNo', header: '사업자번호', cell: ({ row }) => row.original.bizNo || '-' },
  { id: 'contactName', header: '담당자', cell: ({ row }) => row.original.contactName || '-' },
  { id: 'contactPhone', header: '연락처', cell: ({ row }) => row.original.contactPhone || '-' },
  {
    id: 'contractType',
    header: '계약유형',
    cell: ({ row }) => (
      <Badge variant={CONTRACT_TYPE_VARIANT[row.original.contractType] || 'default'}>
        {CONTRACT_TYPE_MAP[row.original.contractType] || row.original.contractType}
      </Badge>
    ),
  },
  {
    id: 'paymentTerms',
    header: '결제조건',
    cell: ({ row }) => PAYMENT_TERMS_MAP[row.original.paymentTerms] || row.original.paymentTerms || '-',
  },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => (
      <Badge
        variant={row.original.isActive ? 'default' : 'secondary'}
        className={row.original.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}
      >
        {row.original.isActive ? '활성' : '비활성'}
      </Badge>
    ),
  },
]

export default function ShippersPage() {
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ShipperRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const queryClient = useQueryClient()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-shippers'],
    queryFn: () => api.get('/sales/3pl/shippers') as Promise<{ data: ShipperRow[] }>,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/3pl/shippers', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-shippers'] })
      setOpen(false)
      toast.success('화주사가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/sales/3pl/shippers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-shippers'] })
      setEditTarget(null)
      toast.success('화주사 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/3pl/shippers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['3pl-shippers'] })
      toast.success('화주사가 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const shippers: ShipperRow[] = data?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      companyName: form.get('companyName'),
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      phone: form.get('phone') || undefined,
      email: form.get('email') || undefined,
      address: form.get('address') || undefined,
      contactName: form.get('contactName') || undefined,
      contactPhone: form.get('contactPhone') || undefined,
      contactEmail: form.get('contactEmail') || undefined,
      contractType: form.get('contractType') || 'STANDARD',
      paymentTerms: form.get('paymentTerms') || 'PREPAID',
      billingCycle: form.get('billingCycle') || 'MONTHLY',
      contractStart: form.get('contractStart') || undefined,
      contractEnd: form.get('contractEnd') || undefined,
      memo: form.get('memo') || undefined,
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
      phone: form.get('phone') || undefined,
      email: form.get('email') || undefined,
      address: form.get('address') || undefined,
      contactName: form.get('contactName') || undefined,
      contactPhone: form.get('contactPhone') || undefined,
      contactEmail: form.get('contactEmail') || undefined,
      contractType: form.get('contractType') || 'STANDARD',
      paymentTerms: form.get('paymentTerms') || 'PREPAID',
      billingCycle: form.get('billingCycle') || 'MONTHLY',
      contractStart: form.get('contractStart') || undefined,
      contractEnd: form.get('contractEnd') || undefined,
      memo: form.get('memo') || undefined,
      isActive: form.get('isActive') === 'true',
    })
  }

  const renderForm = (target?: ShipperRow) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>
          회사명 <span className="text-destructive">*</span>
        </Label>
        <Input name="companyName" required aria-required="true" defaultValue={target?.companyName || ''} />
      </div>
      <div className="space-y-2">
        <Label>회사코드</Label>
        {target ? (
          <Input value={target.companyCode} disabled className="bg-muted" />
        ) : (
          <Input disabled placeholder="자동생성" className="bg-muted" />
        )}
      </div>
      <div className="space-y-2">
        <Label>사업자번호</Label>
        <Input name="bizNo" defaultValue={target?.bizNo || ''} placeholder="000-00-00000" />
      </div>
      <div className="space-y-2">
        <Label>대표자</Label>
        <Input name="ceoName" defaultValue={target?.ceoName || ''} />
      </div>
      <div className="space-y-2">
        <Label>전화번호</Label>
        <Input name="phone" defaultValue={target?.phone || ''} />
      </div>
      <div className="space-y-2">
        <Label>이메일</Label>
        <Input name="email" type="email" defaultValue={target?.email || ''} />
      </div>
      <div className="col-span-full space-y-2">
        <Label>주소</Label>
        <Input name="address" defaultValue={target?.address || ''} />
      </div>
      <div className="space-y-2">
        <Label>담당자</Label>
        <Input name="contactName" defaultValue={target?.contactName || ''} />
      </div>
      <div className="space-y-2">
        <Label>담당자 연락처</Label>
        <Input name="contactPhone" defaultValue={target?.contactPhone || ''} />
      </div>
      <div className="col-span-full space-y-2">
        <Label>담당자 이메일</Label>
        <Input name="contactEmail" type="email" defaultValue={target?.contactEmail || ''} />
      </div>
      <div className="space-y-2">
        <Label>계약유형</Label>
        <Select name="contractType" defaultValue={target?.contractType || 'STANDARD'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CONTRACT_TYPE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>결제조건</Label>
        <Select name="paymentTerms" defaultValue={target?.paymentTerms || 'PREPAID'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAYMENT_TERMS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>정산주기</Label>
        <Select name="billingCycle" defaultValue={target?.billingCycle || 'MONTHLY'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(BILLING_CYCLE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>계약 시작일</Label>
        <Input name="contractStart" type="date" defaultValue={target?.contractStart || ''} />
      </div>
      <div className="space-y-2">
        <Label>계약 종료일</Label>
        <Input name="contractEnd" type="date" defaultValue={target?.contractEnd || ''} />
      </div>
      {target && (
        <div className="space-y-2">
          <Label>상태</Label>
          <Select name="isActive" defaultValue={target.isActive ? 'true' : 'false'}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">활성</SelectItem>
              <SelectItem value="false">비활성</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="col-span-full space-y-2">
        <Label>메모</Label>
        <Input name="memo" defaultValue={target?.memo || ''} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="화주사 관리" description="3PL 화주사를 등록하고 관리합니다" />
      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>화주사 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>화주사 등록</DialogTitle>
              <p className="text-muted-foreground text-xs">
                <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
              </p>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              {renderForm()}
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '화주사 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
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
                  onClick={() => setEditTarget(row.original)}
                  aria-label="수정"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => setDeleteTarget({ id: row.original.id, name: row.original.companyName })}
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
            size: 80,
          },
        ]}
        data={shippers}
        searchColumn="companyName"
        searchPlaceholder="회사명으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>화주사 수정</DialogTitle>
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
            </p>
          </DialogHeader>
          {editTarget && (
            <form key={editTarget.id} onSubmit={handleUpdate} className="space-y-4">
              {renderForm(editTarget)}
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '수정 중...' : '수정'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="화주사 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
