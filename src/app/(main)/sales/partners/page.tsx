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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { ExcelImportDialog } from '@/components/common/excel-import-dialog'
import type { TemplateColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Upload, Trash2, Pencil } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const PARTNER_TYPE_MAP: Record<string, string> = {
  SALES: '매출', PURCHASE: '매입', BOTH: '매출/매입',
}

const CHANNEL_MAP: Record<string, string> = {
  ONLINE: '온라인', OFFLINE: '오프라인',
}

interface PartnerRow {
  id: string; partnerCode: string; partnerName: string; partnerType: string
  salesChannel: string
  bizNo: string | null; ceoName: string | null; phone: string | null; fax: string | null
  email: string | null; address: string | null; contactPerson: string | null
  bizType: string | null; bizCategory: string | null
  creditLimit: number | null; paymentTerms: string | null; isActive: boolean
}

const columns: ColumnDef<PartnerRow>[] = [
  { accessorKey: 'partnerCode', header: '거래처코드', cell: ({ row }) => <span className="font-mono text-xs">{row.original.partnerCode}</span> },
  { accessorKey: 'partnerName', header: '거래처명', cell: ({ row }) => <span className="font-medium">{row.original.partnerName}</span> },
  { id: 'partnerType', header: '구분', cell: ({ row }) => <Badge variant="outline">{PARTNER_TYPE_MAP[row.original.partnerType] || row.original.partnerType}</Badge> },
  { id: 'salesChannel', header: '채널', cell: ({ row }) => <Badge variant={row.original.salesChannel === 'ONLINE' ? 'default' : 'secondary'}>{CHANNEL_MAP[row.original.salesChannel] || '오프라인'}</Badge> },
  { id: 'bizNo', header: '사업자번호', cell: ({ row }) => row.original.bizNo || '-' },
  { id: 'ceoName', header: '대표자', cell: ({ row }) => row.original.ceoName || '-' },
  { id: 'phone', header: '연락처', cell: ({ row }) => row.original.phone || '-' },
  { id: 'contactPerson', header: '담당자', cell: ({ row }) => row.original.contactPerson || '-' },
  { id: 'creditLimit', header: '여신한도', cell: ({ row }) => row.original.creditLimit ? formatCurrency(row.original.creditLimit) : '-' },
  { id: 'status', header: '상태', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'secondary'}>{row.original.isActive ? '활성' : '비활성'}</Badge> },
]

export default function PartnersPage() {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editTarget, setEditTarget] = useState<PartnerRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (typeFilter && typeFilter !== 'all') qp.set('partnerType', typeFilter)
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading } = useQuery({
    queryKey: ['partners', typeFilter, startDate, endDate],
    queryFn: () => api.get(`/partners?${qp.toString()}`) as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/partners', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      setOpen(false)
      toast.success('거래처가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => api.put(`/partners/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] })
      setEditTarget(null)
      toast.success('거래처 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/partners/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partners'] }); toast.success('거래처가 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      partnerName: form.get('partnerName'),
      partnerType: form.get('partnerType'),
      salesChannel: form.get('salesChannel'),
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      bizType: form.get('bizType') || undefined,
      bizCategory: form.get('bizCategory') || undefined,
      phone: form.get('phone') || undefined,
      fax: form.get('fax') || undefined,
      email: form.get('email') || undefined,
      address: form.get('address') || undefined,
      contactPerson: form.get('contactPerson') || undefined,
      creditLimit: form.get('creditLimit') ? parseFloat(form.get('creditLimit') as string) : undefined,
      paymentTerms: form.get('paymentTerms') || undefined,
      isActive: form.get('isActive') === 'true',
    })
  }

  const partners: PartnerRow[] = data?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '거래처코드', accessor: 'partnerCode' },
    { header: '거래처명', accessor: 'partnerName' },
    { header: '구분', accessor: (r) => PARTNER_TYPE_MAP[r.partnerType] || r.partnerType },
    { header: '채널', accessor: (r) => CHANNEL_MAP[r.salesChannel] || '오프라인' },
    { header: '사업자번호', accessor: (r) => r.bizNo || '' },
    { header: '대표자', accessor: (r) => r.ceoName || '' },
    { header: '전화번호', accessor: (r) => r.phone || '' },
    { header: '담당자', accessor: (r) => r.contactPerson || '' },
    { header: '이메일', accessor: (r) => r.email || '' },
    { header: '여신한도', accessor: (r) => r.creditLimit ? formatCurrency(r.creditLimit) : '' },
    { header: '상태', accessor: (r) => r.isActive ? '활성' : '비활성' },
  ]

  const importTemplateColumns: TemplateColumn[] = [
    { header: '거래처코드', key: 'partnerCode', example: 'PTN-001', required: true },
    { header: '거래처명', key: 'partnerName', example: '테스트거래처', required: true },
    { header: '구분', key: 'partnerType', example: '매출/매입' },
    { header: '채널', key: 'salesChannel', example: '오프라인' },
    { header: '사업자번호', key: 'bizNo', example: '123-45-67890' },
    { header: '대표자', key: 'ceoName', example: '홍길동' },
    { header: '업태', key: 'bizType', example: '제조' },
    { header: '종목', key: 'bizCategory', example: '전자부품' },
    { header: '전화번호', key: 'phone', example: '02-1234-5678' },
    { header: '팩스', key: 'fax', example: '02-1234-5679' },
    { header: '이메일', key: 'email', example: 'partner@test.com' },
    { header: '주소', key: 'address', example: '서울시 강남구' },
    { header: '담당자', key: 'contactPerson', example: '김담당' },
    { header: '여신한도', key: 'creditLimit', example: '10000000' },
    { header: '결제조건', key: 'paymentTerms', example: '월말 30일' },
  ]

  const importKeyMap: Record<string, string> = {
    '거래처코드': 'partnerCode', '거래처명': 'partnerName', '구분': 'partnerType',
    '채널': 'salesChannel', '사업자번호': 'bizNo', '대표자': 'ceoName', '업태': 'bizType',
    '종목': 'bizCategory', '전화번호': 'phone', '연락처': 'phone', '팩스': 'fax',
    '이메일': 'email', '주소': 'address', '담당자': 'contactPerson',
    '여신한도': 'creditLimit', '결제조건': 'paymentTerms',
  }

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '거래처목록', title: '거래처관리 목록', columns: exportColumns, data: partners }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      partnerCode: form.get('partnerCode'),
      partnerName: form.get('partnerName'),
      partnerType: form.get('partnerType') || 'BOTH',
      salesChannel: form.get('salesChannel') || 'OFFLINE',
      bizNo: form.get('bizNo') || undefined,
      ceoName: form.get('ceoName') || undefined,
      bizType: form.get('bizType') || undefined,
      bizCategory: form.get('bizCategory') || undefined,
      phone: form.get('phone') || undefined,
      fax: form.get('fax') || undefined,
      email: form.get('email') || undefined,
      address: form.get('address') || undefined,
      contactPerson: form.get('contactPerson') || undefined,
      creditLimit: form.get('creditLimit') ? parseFloat(form.get('creditLimit') as string) : undefined,
      paymentTerms: form.get('paymentTerms') || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="거래처관리" description="고객 및 공급업체 정보를 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="전체 구분" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(PARTNER_TYPE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" className="w-full sm:w-36" value={startDate} onChange={e => setStartDate(e.target.value)} placeholder="시작일" />
          <span className="text-xs text-muted-foreground">~</span>
          <Input type="date" className="w-full sm:w-36" value={endDate} onChange={e => setEndDate(e.target.value)} placeholder="종료일" />
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> 업로드
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>거래처 등록</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>거래처 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>거래처코드 <span className="text-destructive">*</span></Label><Input name="partnerCode" required aria-required="true" placeholder="PTN-001" /></div>
                <div className="space-y-2"><Label>거래처명 <span className="text-destructive">*</span></Label><Input name="partnerName" required aria-required="true" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>구분</Label>
                  <Select name="partnerType" defaultValue="BOTH">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PARTNER_TYPE_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>매출채널</Label>
                  <Select name="salesChannel" defaultValue="OFFLINE">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONLINE">온라인</SelectItem>
                      <SelectItem value="OFFLINE">오프라인</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>사업자번호</Label><Input name="bizNo" placeholder="000-00-00000" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>대표자</Label><Input name="ceoName" /></div>
                <div className="space-y-2"><Label>담당자</Label><Input name="contactPerson" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>업태</Label><Input name="bizType" /></div>
                <div className="space-y-2"><Label>종목</Label><Input name="bizCategory" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>전화번호</Label><Input name="phone" /></div>
                <div className="space-y-2"><Label>팩스</Label><Input name="fax" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>이메일</Label><Input name="email" type="email" /></div>
                <div className="space-y-2"><Label>여신한도</Label><Input name="creditLimit" type="number" /></div>
              </div>
              <div className="space-y-2"><Label>주소</Label><Input name="address" /></div>
              <div className="space-y-2"><Label>결제조건</Label><Input name="paymentTerms" placeholder="월말 30일" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '거래처 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={[...columns, { id: 'actions', header: '', cell: ({ row }: any) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditTarget(row.original)} aria-label="수정"><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id, row.original.partnerName)} aria-label="삭제"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ), size: 80 }]} data={partners} searchColumn="partnerName" searchPlaceholder="거래처명으로 검색..." isLoading={isLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="거래처 대량등록"
        apiEndpoint="/partners/import"
        templateColumns={importTemplateColumns}
        templateFileName="거래처_업로드_템플릿"
        keyMap={importKeyMap}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['partners'] })}
      />
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>거래처 수정</DialogTitle></DialogHeader>
          {editTarget && (
            <form key={editTarget.id} onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>거래처코드</Label><Input value={editTarget.partnerCode} disabled className="bg-muted" /></div>
                <div className="space-y-2"><Label>거래처명 <span className="text-destructive">*</span></Label><Input name="partnerName" required aria-required="true" defaultValue={editTarget.partnerName} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>구분</Label>
                  <Select name="partnerType" defaultValue={editTarget.partnerType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PARTNER_TYPE_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>매출채널</Label>
                  <Select name="salesChannel" defaultValue={editTarget.salesChannel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ONLINE">온라인</SelectItem>
                      <SelectItem value="OFFLINE">오프라인</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>사업자번호</Label><Input name="bizNo" defaultValue={editTarget.bizNo || ''} placeholder="000-00-00000" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>대표자</Label><Input name="ceoName" defaultValue={editTarget.ceoName || ''} /></div>
                <div className="space-y-2"><Label>담당자</Label><Input name="contactPerson" defaultValue={editTarget.contactPerson || ''} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>업태</Label><Input name="bizType" defaultValue={editTarget.bizType || ''} /></div>
                <div className="space-y-2"><Label>종목</Label><Input name="bizCategory" defaultValue={editTarget.bizCategory || ''} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>전화번호</Label><Input name="phone" defaultValue={editTarget.phone || ''} /></div>
                <div className="space-y-2"><Label>팩스</Label><Input name="fax" defaultValue={editTarget.fax || ''} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>이메일</Label><Input name="email" type="email" defaultValue={editTarget.email || ''} /></div>
                <div className="space-y-2"><Label>여신한도</Label><Input name="creditLimit" type="number" defaultValue={editTarget.creditLimit || ''} /></div>
              </div>
              <div className="space-y-2"><Label>주소</Label><Input name="address" defaultValue={editTarget.address || ''} /></div>
              <div className="space-y-2"><Label>결제조건</Label><Input name="paymentTerms" defaultValue={editTarget.paymentTerms || ''} placeholder="월말 30일" /></div>
              <div className="space-y-2">
                <Label>상태</Label>
                <Select name="isActive" defaultValue={editTarget.isActive ? 'true' : 'false'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">활성</SelectItem>
                    <SelectItem value="false">비활성</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
        title="거래처 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
