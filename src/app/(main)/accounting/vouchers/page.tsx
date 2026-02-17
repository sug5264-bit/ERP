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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'

interface VoucherRow {
  id: string
  voucherNo: string
  voucherDate: string
  voucherType: string
  description: string | null
  totalDebit: number
  totalCredit: number
  status: string
  createdBy: { nameKo: string }
  approvedBy: { nameKo: string } | null
  _count: { details: number }
}

const TYPE_MAP: Record<string, string> = {
  RECEIPT: '입금', PAYMENT: '출금', TRANSFER: '대체', PURCHASE: '매입', SALES: '매출',
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  DRAFT: { label: '작성', variant: 'secondary' },
  APPROVED: { label: '승인', variant: 'default' },
  CONFIRMED: { label: '확정', variant: 'outline' },
}

const columns: ColumnDef<VoucherRow>[] = [
  { accessorKey: 'voucherNo', header: '전표번호', cell: ({ row }) => <span className="font-mono text-sm">{row.original.voucherNo}</span> },
  { accessorKey: 'voucherDate', header: '전표일자', cell: ({ row }) => formatDate(row.original.voucherDate) },
  { id: 'voucherType', header: '유형', cell: ({ row }) => <Badge variant="outline">{TYPE_MAP[row.original.voucherType] || row.original.voucherType}</Badge> },
  { accessorKey: 'description', header: '적요', cell: ({ row }) => row.original.description || '-' },
  { id: 'totalDebit', header: '차변', cell: ({ row }) => formatCurrency(row.original.totalDebit) },
  { id: 'totalCredit', header: '대변', cell: ({ row }) => formatCurrency(row.original.totalCredit) },
  { id: 'detailCount', header: '분개', cell: ({ row }) => `${row.original._count.details}건` },
  { id: 'status', header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status } },
  { id: 'createdBy', header: '작성자', cell: ({ row }) => row.original.createdBy.nameKo },
]


interface DetailLine { accountSubjectId: string; debitAmount: number; creditAmount: number; description: string }

export default function VouchersPage() {
  const [open, setOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [details, setDetails] = useState<DetailLine[]>([
    { accountSubjectId: '', debitAmount: 0, creditAmount: 0, description: '' },
    { accountSubjectId: '', debitAmount: 0, creditAmount: 0, description: '' },
  ])
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (typeFilter && typeFilter !== 'all') qp.set('voucherType', typeFilter)
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['accounting-vouchers', typeFilter, statusFilter],
    queryFn: () => api.get(`/accounting/vouchers?${qp.toString()}`) as Promise<any>,
  })
  const { data: accountsData } = useQuery({
    queryKey: ['accounting-accounts'],
    queryFn: () => api.get('/accounting/accounts') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/accounting/vouchers', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-vouchers'] })
      setOpen(false)
      setDetails([
        { accountSubjectId: '', debitAmount: 0, creditAmount: 0, description: '' },
        { accountSubjectId: '', debitAmount: 0, creditAmount: 0, description: '' },
      ])
      toast.success('전표가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/accounting/vouchers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accounting-vouchers'] }); toast.success('전표가 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, voucherNo: string) => {
    if (window.confirm(`전표 [${voucherNo}]를 삭제하시겠습니까?`)) deleteMutation.mutate(id)
  }

  const vouchers: VoucherRow[] = data?.data || []
  const accounts = accountsData?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '전표번호', accessor: 'voucherNo' },
    { header: '전표일자', accessor: (r) => r.voucherDate ? formatDate(r.voucherDate) : '' },
    { header: '유형', accessor: (r) => TYPE_MAP[r.voucherType] || r.voucherType },
    { header: '적요', accessor: (r) => r.description || '' },
    { header: '차변', accessor: (r) => formatCurrency(r.totalDebit) },
    { header: '대변', accessor: (r) => formatCurrency(r.totalCredit) },
    { header: '분개건수', accessor: (r) => r._count?.details || 0 },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
    { header: '작성자', accessor: (r) => r.createdBy?.nameKo || '' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '전표목록', title: '전표관리 목록', columns: exportColumns, data: vouchers }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const addLine = () => setDetails([...details, { accountSubjectId: '', debitAmount: 0, creditAmount: 0, description: '' }])
  const removeLine = (idx: number) => { if (details.length <= 2) return; setDetails(details.filter((_, i) => i !== idx)) }
  const updateLine = (idx: number, field: string, value: any) => { const n = [...details]; (n[idx] as any)[field] = value; setDetails(n) }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      voucherDate: form.get('voucherDate'),
      voucherType: form.get('voucherType'),
      description: form.get('description') || undefined,
      details: details.filter((d) => d.accountSubjectId),
    })
  }

  const totalDebit = details.reduce((s, d) => s + (d.debitAmount || 0), 0)
  const totalCredit = details.reduce((s, d) => s + (d.creditAmount || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="전표관리" description="회계 전표를 등록하고 관리합니다" />
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 유형" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(TYPE_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>전표 등록</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>전표 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>전표일자 *</Label><Input name="voucherDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>전표유형 *</Label>
                  <Select name="voucherType" required>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{Object.entries(TYPE_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>적요</Label><Input name="description" /></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>분개 내역</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
                </div>
                <div className="space-y-3">
                  {details.map((line, idx) => (
                    <div key={idx} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">분개 #{idx + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(idx)} disabled={details.length <= 2}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <select className="w-full rounded border p-2 text-xs bg-background" value={line.accountSubjectId} onChange={(e) => updateLine(idx, 'accountSubjectId', e.target.value)}>
                        <option value="">계정과목 선택</option>
                        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} - {a.nameKo}</option>)}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1"><Label className="text-xs">차변</Label><Input type="number" className="text-xs text-right" value={line.debitAmount || ''} onChange={(e) => updateLine(idx, 'debitAmount', parseFloat(e.target.value) || 0)} /></div>
                        <div className="space-y-1"><Label className="text-xs">대변</Label><Input type="number" className="text-xs text-right" value={line.creditAmount || ''} onChange={(e) => updateLine(idx, 'creditAmount', parseFloat(e.target.value) || 0)} /></div>
                        <div className="space-y-1"><Label className="text-xs">적요</Label><Input className="text-xs" value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3 text-sm font-medium">
                  <span>합계</span>
                  <div className="flex items-center gap-4">
                    <span>차변: {formatCurrency(totalDebit)}</span>
                    <span>대변: {formatCurrency(totalCredit)}</span>
                    {Math.abs(totalDebit - totalCredit) > 0.01 && <span className="text-destructive text-xs">차액: {formatCurrency(Math.abs(totalDebit - totalCredit))}</span>}
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || Math.abs(totalDebit - totalCredit) > 0.01}>
                {createMutation.isPending ? '등록 중...' : '전표 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={[...columns, { id: 'delete', header: '', cell: ({ row }: any) => <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id, row.original.voucherNo)}><Trash2 className="h-4 w-4" /></Button>, size: 50 }]} data={vouchers} searchColumn="voucherNo" searchPlaceholder="전표번호로 검색..." isLoading={isLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
    </div>
  )
}
