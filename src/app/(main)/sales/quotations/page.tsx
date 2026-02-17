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
import { formatDate, formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { generateQuotationPDF, type QuotationPDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, FileDown } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '임시', variant: 'outline' }, SUBMITTED: { label: '제출', variant: 'default' },
  ORDERED: { label: '발주전환', variant: 'secondary' }, LOST: { label: '실주', variant: 'destructive' }, CANCELLED: { label: '취소', variant: 'destructive' },
}

interface Detail { itemId: string; quantity: number; unitPrice: number }

export default function QuotationsPage() {
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const queryClient = useQueryClient()

  const handlePDF = (q: any) => {
    const pdfData: QuotationPDFData = {
      quotationNo: q.quotationNo,
      quotationDate: formatDate(q.quotationDate),
      validUntil: q.validUntil ? formatDate(q.validUntil) : undefined,
      company: { name: COMPANY_NAME },
      partner: { name: q.partner?.partnerName || '' },
      items: (q.details || []).map((d: any, i: number) => ({
        no: i + 1, itemName: d.item?.itemName || '', spec: d.item?.spec || '',
        qty: Number(d.quantity), unitPrice: Number(d.unitPrice),
        supplyAmount: Number(d.supplyAmount), taxAmount: Number(d.taxAmount), totalAmount: Number(d.totalAmount),
      })),
      totalSupply: Number(q.totalSupply), totalTax: Number(q.totalTax), totalAmount: Number(q.totalAmount),
      description: q.description || undefined,
    }
    generateQuotationPDF(pdfData)
    toast.success('견적서 PDF가 다운로드되었습니다.')
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'quotationNo', header: '견적번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.quotationNo}</span> },
    { id: 'quotationDate', header: '견적일', cell: ({ row }) => formatDate(row.original.quotationDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'employee', header: '담당자', cell: ({ row }) => row.original.employee?.name || '-' },
    { id: 'totalSupply', header: '공급가액', cell: ({ row }) => formatCurrency(row.original.totalSupply) },
    { id: 'totalTax', header: '세액', cell: ({ row }) => formatCurrency(row.original.totalTax) },
    { id: 'totalAmount', header: '합계', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
    { id: 'status', header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status } },
    { id: 'pdf', header: '', cell: ({ row }) => (
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePDF(row.original)} title="견적서 PDF">
        <FileDown className="h-4 w-4" />
      </Button>
    )},
    { id: 'delete', header: '', cell: ({ row }) => (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id, row.original.quotationNo)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    ), size: 50 },
  ]

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({ queryKey: ['sales-quotations', statusFilter], queryFn: () => api.get(`/sales/quotations?${qp}`) as Promise<any> })
  const { data: partnersData } = useQuery({ queryKey: ['partners-sales'], queryFn: () => api.get('/partners?pageSize=500') as Promise<any> })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/quotations', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-quotations'] }); setOpen(false); setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }]); toast.success('견적이 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/quotations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-quotations'] }); toast.success('견적이 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, no: string) => {
    if (window.confirm(`견적 [${no}]을(를) 삭제하시겠습니까?`)) deleteMutation.mutate(id)
  }

  const partners = partnersData?.data || []
  const items = itemsData?.data || []
  const quotations = data?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '견적번호', accessor: 'quotationNo' },
    { header: '견적일', accessor: (r) => r.quotationDate ? formatDate(r.quotationDate) : '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '담당자', accessor: (r) => r.employee?.name || '' },
    { header: '공급가액', accessor: (r) => formatCurrency(r.totalSupply) },
    { header: '세액', accessor: (r) => formatCurrency(r.totalTax) },
    { header: '합계', accessor: (r) => formatCurrency(r.totalAmount) },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '견적목록', title: '견적관리 목록', columns: exportColumns, data: quotations }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const updateDetail = (idx: number, field: string, value: any) => { const d = [...details]; (d[idx] as any)[field] = value; setDetails(d) }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      quotationDate: form.get('quotationDate'), partnerId: form.get('partnerId'),
      validUntil: form.get('validUntil') || undefined, description: form.get('description') || undefined,
      details: details.filter(d => d.itemId),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="견적관리" description="고객 견적서를 작성하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>견적 등록</Button></DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>견적 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>견적일 *</Label><Input name="quotationDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>거래처 *</Label>
                  <Select name="partnerId"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>유효기간</Label><Input name="validUntil" type="date" /></div>
              </div>
              <div className="space-y-2"><Label>비고</Label><Input name="description" /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
                </div>
                <div className="space-y-3">
                  {details.map((d, idx) => {
                    const supply = d.quantity * d.unitPrice; const tax = Math.round(supply * 0.1)
                    return (
                      <div key={idx} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">품목 #{idx + 1}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))} disabled={details.length <= 1}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                        <Select value={d.itemId} onValueChange={v => updateDetail(idx, 'itemId', v)}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="품목 선택" /></SelectTrigger>
                          <SelectContent>{items.map((it: any) => <SelectItem key={it.id} value={it.id}>{it.itemCode} - {it.itemName}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-5 gap-2">
                          <div className="space-y-1"><Label className="text-xs">수량</Label><Input type="number" className="text-xs" value={d.quantity || ''} onChange={e => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1"><Label className="text-xs">단가</Label><Input type="number" className="text-xs" value={d.unitPrice || ''} onChange={e => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></div>
                          <div className="space-y-1"><Label className="text-xs">공급가</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs">{formatCurrency(supply)}</div></div>
                          <div className="space-y-1"><Label className="text-xs">세액</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs">{formatCurrency(tax)}</div></div>
                          <div className="space-y-1"><Label className="text-xs">합계</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs font-medium">{formatCurrency(supply + tax)}</div></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-right font-medium text-sm">합계: {formatCurrency(details.reduce((s, d) => { const sup = d.quantity * d.unitPrice; return s + sup + Math.round(sup * 0.1) }, 0))}</div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '견적 등록'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={quotations} searchColumn="quotationNo" searchPlaceholder="견적번호로 검색..." isLoading={isLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
    </div>
  )
}
