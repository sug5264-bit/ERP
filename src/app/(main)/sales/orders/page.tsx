'use client'

import { useState, useRef } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate, formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, downloadImportTemplate, readExcelFile, type ExportColumn } from '@/lib/export'
import { generateTaxInvoicePDF, type TaxInvoicePDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, MoreHorizontal, CheckCircle, XCircle, FileDown, Upload } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ORDERED: { label: '발주', variant: 'default' }, IN_PROGRESS: { label: '진행중', variant: 'secondary' },
  COMPLETED: { label: '완료', variant: 'outline' }, CANCELLED: { label: '취소', variant: 'destructive' },
}

interface Detail { itemId: string; quantity: number; unitPrice: number }

interface TrackingRow {
  deliveryNo: string
  carrier: string
  trackingNo: string
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<string>('ONLINE')
  const [open, setOpen] = useState(false)
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const [trackingRows, setTrackingRows] = useState<TrackingRow[]>([])
  const [trackingResult, setTrackingResult] = useState<{ total: number; success: number; failed: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleTaxInvoicePDF = (order: any) => {
    const orderDate = new Date(order.orderDate)
    const pdfData: TaxInvoicePDFData = {
      invoiceNo: order.orderNo,
      invoiceDate: formatDate(order.orderDate),
      supplier: { name: COMPANY_NAME, bizNo: '', ceo: '', address: '' },
      buyer: { name: order.partner?.partnerName || '', bizNo: order.partner?.bizNo || '', ceo: order.partner?.ceoName || '', address: order.partner?.address || '' },
      items: (order.details || []).map((d: any) => ({
        month: String(orderDate.getMonth() + 1), day: String(orderDate.getDate()),
        itemName: d.item?.itemName || '', spec: d.item?.spec || '',
        qty: Number(d.quantity), unitPrice: Number(d.unitPrice),
        supplyAmount: Number(d.supplyAmount), taxAmount: Number(d.taxAmount),
      })),
      totalSupply: Number(order.totalSupply), totalTax: Number(order.totalTax), totalAmount: Number(order.totalAmount),
    }
    generateTaxInvoicePDF(pdfData)
    toast.success('세금계산서 PDF가 다운로드되었습니다.')
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.put(`/sales/orders/${id}`, { action: 'complete' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('발주가 완료 처리되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/sales/orders/${id}`, { action: 'cancel' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('발주가 취소 처리되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/orders/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); toast.success('발주가 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const trackingMutation = useMutation({
    mutationFn: (body: { trackings: TrackingRow[] }) => api.post('/sales/deliveries/tracking', body),
    onSuccess: (res: any) => {
      const result = res.data || res
      setTrackingResult(result)
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      toast.success(`운송장 업로드 완료: 성공 ${result.success}건, 실패 ${result.failed}건`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, no: string) => {
    if (window.confirm(`발주 [${no}]를 삭제하시겠습니까?`)) deleteMutation.mutate(id)
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'orderNo', header: '발주번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span> },
    { id: 'orderDate', header: '발주일', cell: ({ row }) => formatDate(row.original.orderDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'deliveryDate', header: '납기일', cell: ({ row }) => row.original.deliveryDate ? formatDate(row.original.deliveryDate) : '-' },
    { id: 'totalAmount', header: '합계', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
    { id: 'status', header: '상태', cell: ({ row }) => { const s = STATUS_MAP[row.original.status]; return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status } },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const status = row.original.status
        const canComplete = status === 'ORDERED' || status === 'IN_PROGRESS'
        const canCancel = status !== 'CANCELLED' && status !== 'COMPLETED'
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleTaxInvoicePDF(row.original)}>
                <FileDown className="mr-2 h-4 w-4" />
                세금계산서 PDF
              </DropdownMenuItem>
              {canComplete && (
                <DropdownMenuItem onClick={() => completeMutation.mutate(row.original.id)} disabled={completeMutation.isPending}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  완료 처리
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem onClick={() => cancelMutation.mutate(row.original.id)} disabled={cancelMutation.isPending}>
                  <XCircle className="mr-2 h-4 w-4" />
                  취소 처리
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(row.original.id, row.original.orderNo)} disabled={deleteMutation.isPending}>
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const qpOnline = new URLSearchParams({ pageSize: '50', salesChannel: 'ONLINE' })
  const qpOffline = new URLSearchParams({ pageSize: '50', salesChannel: 'OFFLINE' })
  if (statusFilter && statusFilter !== 'all') { qpOnline.set('status', statusFilter); qpOffline.set('status', statusFilter) }

  const { data: onlineData, isLoading: onlineLoading } = useQuery({ queryKey: ['sales-orders', 'ONLINE', statusFilter], queryFn: () => api.get(`/sales/orders?${qpOnline}`) as Promise<any> })
  const { data: offlineData, isLoading: offlineLoading } = useQuery({ queryKey: ['sales-orders', 'OFFLINE', statusFilter], queryFn: () => api.get(`/sales/orders?${qpOffline}`) as Promise<any> })
  const { data: partnersData } = useQuery({ queryKey: ['partners-sales'], queryFn: () => api.get('/partners?pageSize=500') as Promise<any> })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/orders', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); setOpen(false); setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }]); toast.success('발주가 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const partners = partnersData?.data || []
  const items = itemsData?.data || []
  const onlineOrders = onlineData?.data || []
  const offlineOrders = offlineData?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '발주번호', accessor: 'orderNo' },
    { header: '발주일', accessor: (r) => r.orderDate ? formatDate(r.orderDate) : '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '납기일', accessor: (r) => r.deliveryDate ? formatDate(r.deliveryDate) : '' },
    { header: '합계', accessor: (r) => r.totalAmount ? formatCurrency(r.totalAmount) : '' },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const currentOrders = activeTab === 'ONLINE' ? onlineOrders : offlineOrders
    const tabLabel = activeTab === 'ONLINE' ? '온라인' : '오프라인'
    const cfg = { fileName: `발주목록_${tabLabel}`, title: `발주관리 목록 (${tabLabel})`, columns: exportColumns, data: currentOrders }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const updateDetail = (idx: number, field: string, value: any) => { const d = [...details]; (d[idx] as any)[field] = value; setDetails(d) }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      orderDate: form.get('orderDate'), partnerId: form.get('partnerId'),
      salesChannel: activeTab,
      deliveryDate: form.get('deliveryDate') || undefined, description: form.get('description') || undefined,
      details: details.filter(d => d.itemId),
    })
  }

  const handleTemplateDownload = () => {
    downloadImportTemplate({
      fileName: '운송장_업로드_템플릿',
      sheetName: '운송장',
      columns: [
        { header: '납품번호', key: 'deliveryNo', example: 'DLV-20260101-001', width: 24 },
        { header: '택배사', key: 'carrier', example: 'CJ대한통운', width: 16 },
        { header: '운송장번호', key: 'trackingNo', example: '1234567890', width: 20 },
      ],
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file, { '납품번호': 'deliveryNo', '택배사': 'carrier', '운송장번호': 'trackingNo' })
      setTrackingRows(rows as TrackingRow[])
      setTrackingResult(null)
    } catch (err) { toast.error('엑셀 파일을 읽을 수 없습니다.') }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTrackingUpload = () => {
    if (trackingRows.length === 0) { toast.error('업로드할 데이터가 없습니다.'); return }
    trackingMutation.mutate({ trackings: trackingRows })
  }

  // Create dialog (shared)
  const createDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>발주 등록</Button></DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>발주 등록 ({activeTab === 'ONLINE' ? '온라인' : '오프라인'})</DialogTitle></DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>발주일 *</Label><Input name="orderDate" type="date" required /></div>
            <div className="space-y-2">
              <Label>거래처 *</Label>
              <Select name="partnerId"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>납기일</Label><Input name="deliveryDate" type="date" /></div>
          </div>
          <div className="space-y-2"><Label>비고</Label><Input name="description" /></div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>품목</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
            </div>
            <div className="space-y-3">
              {details.map((d, idx) => {
                const supply = d.quantity * d.unitPrice
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
                    <div className="grid grid-cols-4 gap-2">
                      <div className="space-y-1"><Label className="text-xs">수량</Label><Input type="number" className="text-xs" value={d.quantity || ''} onChange={e => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-1"><Label className="text-xs">단가</Label><Input type="number" className="text-xs" value={d.unitPrice || ''} onChange={e => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-1"><Label className="text-xs">공급가</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs">{formatCurrency(supply)}</div></div>
                      <div className="space-y-1"><Label className="text-xs">합계</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs font-medium">{formatCurrency(supply + Math.round(supply * 0.1))}</div></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '발주 등록'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )

  // Tracking upload dialog (online only)
  const trackingDialog = (
    <Dialog open={trackingOpen} onOpenChange={(v) => { setTrackingOpen(v); if (!v) { setTrackingRows([]); setTrackingResult(null) } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" />운송장 업로드</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>운송장 일괄 업로드</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={handleTemplateDownload}>템플릿 다운로드</Button>
            <div className="flex-1"><Input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileSelect} /></div>
          </div>

          {trackingRows.length > 0 && (
            <div className="space-y-2">
              <Label>미리보기 (최대 5건)</Label>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="p-2 text-left">납품번호</th><th className="p-2 text-left">택배사</th><th className="p-2 text-left">운송장번호</th></tr></thead>
                  <tbody>
                    {trackingRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-mono text-xs">{row.deliveryNo}</td>
                        <td className="p-2">{row.carrier}</td>
                        <td className="p-2 font-mono text-xs">{row.trackingNo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {trackingRows.length > 5 && <p className="text-sm text-muted-foreground">외 {trackingRows.length - 5}건</p>}
              <Button className="w-full" onClick={handleTrackingUpload} disabled={trackingMutation.isPending}>
                {trackingMutation.isPending ? '업로드 중...' : `업로드 (${trackingRows.length}건)`}
              </Button>
            </div>
          )}

          {trackingResult && (
            <div className="rounded-md border p-4 space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span>전체: <strong>{trackingResult.total}건</strong></span>
                <span className="text-green-600">성공: <strong>{trackingResult.success}건</strong></span>
                <span className="text-red-600">실패: <strong>{trackingResult.failed}건</strong></span>
              </div>
              {trackingResult.errors.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-red-600">오류 목록</Label>
                  <div className="max-h-32 overflow-y-auto text-xs text-red-600 space-y-1">
                    {trackingResult.errors.map((err, idx) => <p key={idx}>{err}</p>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="발주관리" description="발주를 등록하고 관리합니다" />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ONLINE">온라인</TabsTrigger>
          <TabsTrigger value="OFFLINE">오프라인</TabsTrigger>
        </TabsList>

        <TabsContent value="ONLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {createDialog}
              {trackingDialog}
            </div>
            <DataTable columns={columns} data={onlineOrders} searchColumn="orderNo" searchPlaceholder="발주번호로 검색..." isLoading={onlineLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
          </div>
        </TabsContent>

        <TabsContent value="OFFLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {createDialog}
            </div>
            <DataTable columns={columns} data={offlineOrders} searchColumn="orderNo" searchPlaceholder="발주번호로 검색..." isLoading={offlineLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
