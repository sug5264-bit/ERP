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
import { generateTaxInvoicePDF, generateTransactionStatementPDF, type TaxInvoicePDFData, type TransactionStatementPDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, MoreHorizontal, CheckCircle, XCircle, FileDown, Upload, Pencil, Download, FileText, Search, Filter, RotateCcw } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ORDERED: { label: '발주', variant: 'default' }, IN_PROGRESS: { label: '진행중', variant: 'secondary' },
  COMPLETED: { label: '완료', variant: 'outline' }, CANCELLED: { label: '취소', variant: 'destructive' },
  COMPLAINT: { label: '컨플레인', variant: 'destructive' }, EXCHANGE: { label: '교환', variant: 'secondary' },
  RETURN: { label: '반품', variant: 'destructive' },
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [dateFilter, setDateFilter] = useState<'monthly' | 'daily' | 'preset'>('preset')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [datePreset, setDatePreset] = useState('thisMonth')
  const [partnerFilter, setPartnerFilter] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)
  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false)
  const [batchCompleteIds, setBatchCompleteIds] = useState<string[]>([])
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const [trackingRows, setTrackingRows] = useState<TrackingRow[]>([])
  const [trackingResult, setTrackingResult] = useState<{ total: number; success: number; failed: number; errors: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleTaxInvoicePDF = async (order: any) => {
    // 목록 API에서는 details를 포함하지 않으므로 개별 주문 상세 조회
    let orderDetail = order
    try {
      const res = await api.get(`/sales/orders/${order.id}`) as any
      orderDetail = res.data || res
    } catch {
      toast.error('주문 상세 정보를 불러올 수 없습니다.')
      return
    }
    const orderDate = new Date(orderDetail.orderDate)
    // 기본 회사 정보 조회
    let companyInfo = { name: COMPANY_NAME, bizNo: '', ceo: '', address: '', bizType: '', bizItem: '' }
    try {
      const compRes = await api.get('/admin/company') as any
      const defaultCompany = (compRes?.data || []).find((c: any) => c.isDefault) || (compRes?.data || [])[0]
      if (defaultCompany) {
        companyInfo = { name: defaultCompany.companyName, bizNo: defaultCompany.bizNo || '', ceo: defaultCompany.ceoName || '', address: defaultCompany.address || '', bizType: defaultCompany.bizType || '', bizItem: defaultCompany.bizCategory || '' }
      }
    } catch { /* use defaults */ }
    const pdfData: TaxInvoicePDFData = {
      invoiceNo: orderDetail.orderNo,
      invoiceDate: formatDate(orderDetail.orderDate),
      supplier: companyInfo,
      buyer: { name: orderDetail.partner?.partnerName || '', bizNo: orderDetail.partner?.bizNo || '', ceo: orderDetail.partner?.ceoName || '', address: orderDetail.partner?.address || '' },
      items: (orderDetail.details || []).map((d: any) => ({
        month: String(orderDate.getMonth() + 1), day: String(orderDate.getDate()),
        itemName: d.item?.itemName || '', spec: d.item?.specification || '',
        qty: Number(d.quantity), unitPrice: Number(d.unitPrice),
        supplyAmount: Number(d.supplyAmount), taxAmount: Number(d.taxAmount),
      })),
      totalSupply: Number(orderDetail.totalSupply), totalTax: Number(orderDetail.totalTax), totalAmount: Number(orderDetail.totalAmount),
    }
    generateTaxInvoicePDF(pdfData)
    toast.success('세금계산서 PDF가 다운로드되었습니다.')
  }

  // 거래명세표 PDF
  const handleTransactionStatementPDF = async (order: any) => {
    let orderDetail = order
    try {
      const res = await api.get(`/sales/orders/${order.id}`) as any
      orderDetail = res.data || res
    } catch {
      toast.error('주문 상세 정보를 불러올 수 없습니다.')
      return
    }
    // 기본 회사 정보 조회
    let companyInfo = { name: COMPANY_NAME, bizNo: '', ceo: '', address: '', tel: '' }
    try {
      const compRes = await api.get('/admin/company') as any
      const defaultCompany = (compRes?.data || []).find((c: any) => c.isDefault) || (compRes?.data || [])[0]
      if (defaultCompany) {
        companyInfo = { name: defaultCompany.companyName, bizNo: defaultCompany.bizNo || '', ceo: defaultCompany.ceoName || '', address: defaultCompany.address || '', tel: defaultCompany.phone || '' }
      }
    } catch { /* use defaults */ }
    const pdfData: TransactionStatementPDFData = {
      statementNo: orderDetail.orderNo,
      statementDate: formatDate(orderDetail.orderDate),
      supplier: companyInfo,
      buyer: { name: orderDetail.partner?.partnerName || '', bizNo: orderDetail.partner?.bizNo || '', ceo: orderDetail.partner?.ceoName || '', address: orderDetail.partner?.address || '', tel: orderDetail.partner?.phone || '' },
      items: (orderDetail.details || []).map((d: any, idx: number) => ({
        no: idx + 1, itemName: d.item?.itemName || '', spec: d.item?.specification || '',
        qty: Number(d.quantity), unitPrice: Number(d.unitPrice), amount: Number(d.supplyAmount), remark: d.remark || '',
      })),
      totalAmount: Number(orderDetail.totalAmount),
    }
    generateTransactionStatementPDF(pdfData)
    toast.success('거래명세표 PDF가 다운로드되었습니다.')
  }

  // 발주 수정
  const [editTarget, setEditTarget] = useState<any>(null)
  const [editDetails, setEditDetails] = useState<Detail[]>([])
  const editMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => api.put(`/sales/orders/${id}`, { action: 'update', ...body }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); setEditTarget(null); toast.success('발주가 수정되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleEdit = async (order: any) => {
    try {
      const res = await api.get(`/sales/orders/${order.id}`) as any
      const detail = res.data || res
      setEditTarget(detail)
      setEditDetails((detail.details || []).map((d: any) => ({ itemId: d.itemId || d.item?.id, quantity: Number(d.quantity), unitPrice: Number(d.unitPrice) })))
    } catch { toast.error('주문 상세를 불러올 수 없습니다.') }
  }
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    editMutation.mutate({
      id: editTarget.id,
      orderDate: form.get('orderDate'),
      partnerId: form.get('partnerId'),
      deliveryDate: form.get('deliveryDate') || undefined,
      description: form.get('description') || undefined,
      dispatchInfo: form.get('dispatchInfo') || undefined,
      receivedBy: form.get('receivedBy') || undefined,
      details: editDetails.filter(d => d.itemId),
    })
  }

  // 완료 처리 (배차정보/담당자 필요)
  const [completeTarget, setCompleteTarget] = useState<any>(null)
  const completeMutation = useMutation({
    mutationFn: ({ id, dispatchInfo, receivedBy }: { id: string; dispatchInfo: string; receivedBy: string }) =>
      api.put(`/sales/orders/${id}`, { action: 'complete', dispatchInfo, receivedBy }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); setCompleteTarget(null); toast.success('발주가 완료 처리되었습니다.') },
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

  const batchMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/orders/batch', body),
    onSuccess: (res: any) => {
      const result = res.data || res
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setBatchCompleteOpen(false)
      setBatchCompleteIds([])
      if (result.failed > 0) {
        toast.error(`성공 ${result.success}건, 실패 ${result.failed}건`)
      } else {
        toast.success(`${result.success}건이 처리되었습니다.`)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, no: string) => {
    setDeleteTarget({ id, name: no })
  }

  const handleResetFilters = () => {
    setStatusFilter('')
    setDateFilter('preset')
    setDatePreset('thisMonth')
    setFilterMonth('')
    setFilterDate('')
    setPartnerFilter('')
    setSearchKeyword('')
    setShowAdvancedFilter(false)
  }

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'orderNo', header: '발주번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span> },
    { id: 'orderDate', header: '발주일', cell: ({ row }) => formatDate(row.original.orderDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'deliveryDate', header: '납기일', cell: ({ row }) => row.original.deliveryDate ? formatDate(row.original.deliveryDate) : '-' },
    { id: 'totalAmount', header: '합계(부가세 포함)', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
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
              <DropdownMenuItem onClick={() => handleTransactionStatementPDF(row.original)}>
                <FileText className="mr-2 h-4 w-4" />
                거래명세표 PDF
              </DropdownMenuItem>
              {canComplete && (
                <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  수정
                </DropdownMenuItem>
              )}
              {canComplete && (
                <DropdownMenuItem onClick={() => setCompleteTarget(row.original)}>
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

  // 날짜 프리셋 계산
  const getPresetDates = (preset: string) => {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()
    switch (preset) {
      case 'today': return { start: new Date(y, m, d).toISOString().split('T')[0], end: new Date(y, m, d).toISOString().split('T')[0] }
      case 'thisWeek': { const dow = now.getDay(); const s = new Date(y, m, d - dow); return { start: s.toISOString().split('T')[0], end: now.toISOString().split('T')[0] } }
      case 'thisMonth': return { start: new Date(y, m, 1).toISOString().split('T')[0], end: new Date(y, m + 1, 0).toISOString().split('T')[0] }
      case 'lastMonth': return { start: new Date(y, m - 1, 1).toISOString().split('T')[0], end: new Date(y, m, 0).toISOString().split('T')[0] }
      case 'last3Months': return { start: new Date(y, m - 2, 1).toISOString().split('T')[0], end: new Date(y, m + 1, 0).toISOString().split('T')[0] }
      case 'thisYear': return { start: new Date(y, 0, 1).toISOString().split('T')[0], end: new Date(y, 11, 31).toISOString().split('T')[0] }
      default: return { start: '', end: '' }
    }
  }

  const buildQueryParams = (channel: string) => {
    const qp = new URLSearchParams({ pageSize: '50', salesChannel: channel })
    if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)
    if (dateFilter === 'preset' && datePreset) {
      const { start, end } = getPresetDates(datePreset)
      if (start) qp.set('startDate', start)
      if (end) qp.set('endDate', end)
    }
    if (dateFilter === 'monthly' && filterMonth) { qp.set('startDate', `${filterMonth}-01`); qp.set('endDate', `${filterMonth}-31`) }
    if (dateFilter === 'daily' && filterDate) { qp.set('startDate', filterDate); qp.set('endDate', filterDate) }
    if (partnerFilter && partnerFilter !== 'all') qp.set('partnerId', partnerFilter)
    if (searchKeyword) qp.set('search', searchKeyword)
    return qp
  }

  const qpOnline = buildQueryParams('ONLINE')
  const qpOffline = buildQueryParams('OFFLINE')

  const { data: onlineData, isLoading: onlineLoading } = useQuery({ queryKey: ['sales-orders', 'ONLINE', statusFilter, filterMonth, filterDate, dateFilter, datePreset, partnerFilter, searchKeyword], queryFn: () => api.get(`/sales/orders?${qpOnline}`) as Promise<any> })
  const { data: offlineData, isLoading: offlineLoading } = useQuery({ queryKey: ['sales-orders', 'OFFLINE', statusFilter, filterMonth, filterDate, dateFilter, datePreset, partnerFilter, searchKeyword], queryFn: () => api.get(`/sales/orders?${qpOffline}`) as Promise<any> })
  const { data: partnersData } = useQuery({ queryKey: ['partners-sales'], queryFn: () => api.get('/partners?pageSize=500') as Promise<any>, staleTime: 10 * 60 * 1000 })
  const { data: itemsData } = useQuery({ queryKey: ['items-all'], queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any>, staleTime: 10 * 60 * 1000 })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/orders', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sales-orders'] }); setOpen(false); setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }]); toast.success('발주가 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const partners = partnersData?.data || []
  const items = itemsData?.data || []
  const onlineOrders = onlineData?.data || []
  const offlineOrders = offlineData?.data || []

  // 요약 통계 계산
  const summaryOrders = activeTab === 'ONLINE' ? onlineOrders : offlineOrders
  const summaryStats = {
    totalCount: summaryOrders.length,
    totalAmount: summaryOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0),
    orderedCount: summaryOrders.filter((o: any) => o.status === 'ORDERED').length,
    inProgressCount: summaryOrders.filter((o: any) => o.status === 'IN_PROGRESS').length,
    completedCount: summaryOrders.filter((o: any) => o.status === 'COMPLETED').length,
  }

  const exportColumns: ExportColumn[] = [
    { header: '발주번호', accessor: 'orderNo' },
    { header: '발주일', accessor: (r) => r.orderDate ? formatDate(r.orderDate) : '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '납기일', accessor: (r) => r.deliveryDate ? formatDate(r.deliveryDate) : '' },
    { header: '합계(부가세 포함)', accessor: (r) => r.totalAmount ? formatCurrency(r.totalAmount) : '' },
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
      carrier: form.get('carrier') || undefined, trackingNo: form.get('trackingNo') || undefined,
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
          {activeTab === 'ONLINE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>택배사</Label><Input name="carrier" placeholder="CJ대한통운, 한진택배 등" /></div>
              <div className="space-y-2"><Label>운송장번호</Label><Input name="trackingNo" placeholder="운송장번호 입력" /></div>
            </div>
          )}
          <div className="space-y-2"><Label>비고</Label><Input name="description" /></div>
          <div className="space-y-2">
            <Label>부가세</Label>
            <Select name="vatIncluded" defaultValue="true">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="true">부가세 포함</SelectItem>
                <SelectItem value="false">부가세 미포함</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>품목</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
            </div>
            <div className="space-y-3">
              {details.map((d, idx) => {
                const supply = d.quantity * d.unitPrice
                const itemTaxType = items.find((it: any) => it.id === d.itemId)?.taxType || 'TAXABLE'
                const tax = itemTaxType === 'TAXABLE' ? Math.round(supply * 0.1) : 0
                return (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">품목 #{idx + 1}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))} disabled={details.length <= 1}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                    <Select value={d.itemId} onValueChange={v => updateDetail(idx, 'itemId', v)}>
                      <SelectTrigger className="text-xs truncate"><SelectValue placeholder="품목 선택" /></SelectTrigger>
                      <SelectContent className="max-w-[calc(100vw-4rem)]">{items.map((it: any) => <SelectItem key={it.id} value={it.id}><span className="truncate">{it.itemCode} - {it.itemName}</span></SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-4 gap-2 min-w-0">
                      <div className="space-y-1 min-w-0"><Label className="text-[11px]">수량</Label><Input type="number" className="text-xs" value={d.quantity || ''} onChange={e => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-1 min-w-0"><Label className="text-[11px]">단가</Label><Input type="number" className="text-xs" value={d.unitPrice || ''} onChange={e => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></div>
                      <div className="space-y-1 min-w-0"><Label className="text-[11px]">공급가</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs">{formatCurrency(supply)}</div></div>
                      <div className="space-y-1 min-w-0"><Label className="text-[11px]">합계</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs font-medium">{formatCurrency(supply + tax)}</div></div>
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

        {/* 공통 필터 영역 */}
        <div className="space-y-3">
          {/* 요약 통계 바 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="rounded-lg border bg-muted/30 p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">전체</p>
              <p className="text-sm sm:text-lg font-bold">{summaryStats.totalCount}건</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">합계 금액</p>
              <p className="text-sm sm:text-lg font-bold">{formatCurrency(summaryStats.totalAmount)}</p>
            </div>
            <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">발주</p>
              <p className="text-sm sm:text-lg font-bold text-blue-600">{summaryStats.orderedCount}건</p>
            </div>
            <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 p-2 sm:p-3 text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">진행중</p>
              <p className="text-sm sm:text-lg font-bold text-yellow-600">{summaryStats.inProgressCount}건</p>
            </div>
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-2 sm:p-3 text-center col-span-2 sm:col-span-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground">완료</p>
              <p className="text-sm sm:text-lg font-bold text-green-600">{summaryStats.completedCount}건</p>
            </div>
          </div>

          {/* 필터 바 1행 */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="전체 상태" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={datePreset} onValueChange={(v) => { setDatePreset(v); setDateFilter('preset') }}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="기간" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="thisWeek">이번 주</SelectItem>
                <SelectItem value="thisMonth">이번 달</SelectItem>
                <SelectItem value="lastMonth">지난 달</SelectItem>
                <SelectItem value="last3Months">최근 3개월</SelectItem>
                <SelectItem value="thisYear">올해</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[140px] sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="발주번호 / 거래처 검색..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && queryClient.invalidateQueries({ queryKey: ['sales-orders'] })}
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleResetFilters}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* 고급 필터 (토글) */}
          {showAdvancedFilter && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3 bg-muted/20">
              <div className="space-y-1">
                <Label className="text-xs">거래처</Label>
                <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="전체 거래처" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">기간 유형</Label>
                <Select value={dateFilter} onValueChange={(v: 'monthly' | 'daily' | 'preset') => setDateFilter(v)}>
                  <SelectTrigger className="w-full sm:w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preset">프리셋</SelectItem>
                    <SelectItem value="monthly">월별</SelectItem>
                    <SelectItem value="daily">일자별</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateFilter === 'monthly' && (
                <div className="space-y-1">
                  <Label className="text-xs">월</Label>
                  <Input type="month" className="w-full sm:w-44" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
                </div>
              )}
              {dateFilter === 'daily' && (
                <div className="space-y-1">
                  <Label className="text-xs">일자</Label>
                  <Input type="date" className="w-full sm:w-44" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>

        <TabsContent value="ONLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {createDialog}
              {trackingDialog}
            </div>
            <DataTable columns={columns} data={onlineOrders} searchColumn="orderNo" searchPlaceholder="발주번호로 검색..." isLoading={onlineLoading} pageSize={50} selectable onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} bulkActions={[
              { label: '일괄 다운로드', icon: <Download className="mr-1.5 h-4 w-4" />, action: (rows) => { exportToExcel({ fileName: '선택_발주목록', title: '발주관리 선택 목록', columns: exportColumns, data: rows }); toast.success('선택한 항목이 다운로드되었습니다.') } },
              { label: '일괄 취소', icon: <XCircle className="mr-1.5 h-4 w-4" />, variant: 'destructive', action: (rows) => { if (confirm(`선택한 ${rows.length}건을 취소하시겠습니까?`)) batchMutation.mutate({ ids: rows.map((r: any) => r.id), action: 'cancel' }) } },
              { label: '일괄 완료', icon: <CheckCircle className="mr-1.5 h-4 w-4" />, action: (rows) => { setBatchCompleteIds(rows.map((r: any) => r.id)); setBatchCompleteOpen(true) } },
            ]} />
          </div>
        </TabsContent>

        <TabsContent value="OFFLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {createDialog}
            </div>
            <DataTable columns={columns} data={offlineOrders} searchColumn="orderNo" searchPlaceholder="발주번호로 검색..." isLoading={offlineLoading} pageSize={50} selectable onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} bulkActions={[
              { label: '일괄 다운로드', icon: <Download className="mr-1.5 h-4 w-4" />, action: (rows) => { exportToExcel({ fileName: '선택_발주목록', title: '발주관리 선택 목록', columns: exportColumns, data: rows }); toast.success('선택한 항목이 다운로드되었습니다.') } },
              { label: '일괄 취소', icon: <XCircle className="mr-1.5 h-4 w-4" />, variant: 'destructive', action: (rows) => { if (confirm(`선택한 ${rows.length}건을 취소하시겠습니까?`)) batchMutation.mutate({ ids: rows.map((r: any) => r.id), action: 'cancel' }) } },
              { label: '일괄 완료', icon: <CheckCircle className="mr-1.5 h-4 w-4" />, action: (rows) => { setBatchCompleteIds(rows.map((r: any) => r.id)); setBatchCompleteOpen(true) } },
            ]} />
          </div>
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="발주 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />

      {/* 발주 수정 Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>발주 수정 - {editTarget?.orderNo}</DialogTitle></DialogHeader>
          {editTarget && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>발주일 *</Label><Input name="orderDate" type="date" required defaultValue={editTarget.orderDate?.split('T')[0]} /></div>
                <div className="space-y-2">
                  <Label>거래처 *</Label>
                  <Select name="partnerId" defaultValue={editTarget.partnerId}>
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>납기일</Label><Input name="deliveryDate" type="date" defaultValue={editTarget.deliveryDate?.split('T')[0] || ''} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>배차정보</Label><Input name="dispatchInfo" defaultValue={editTarget.dispatchInfo || ''} placeholder="차량번호, 운송업체 등" /></div>
                <div className="space-y-2"><Label>발주 담당자</Label><Input name="receivedBy" defaultValue={editTarget.receivedBy || ''} placeholder="담당자 이름" /></div>
              </div>
              <div className="space-y-2"><Label>비고</Label><Input name="description" defaultValue={editTarget.description || ''} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>품목</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditDetails([...editDetails, { itemId: '', quantity: 1, unitPrice: 0 }])}><Plus className="mr-1 h-3 w-3" /> 행 추가</Button>
                </div>
                <div className="space-y-3">
                  {editDetails.map((d, idx) => {
                    const supply = d.quantity * d.unitPrice
                    const editItemTaxType = items.find((it: any) => it.id === d.itemId)?.taxType || 'TAXABLE'
                    const editTax = editItemTaxType === 'TAXABLE' ? Math.round(supply * 0.1) : 0
                    return (
                      <div key={idx} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-medium">품목 #{idx + 1}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => editDetails.length > 1 && setEditDetails(editDetails.filter((_, i) => i !== idx))} disabled={editDetails.length <= 1}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                        <Select value={d.itemId} onValueChange={v => { const nd = [...editDetails]; nd[idx].itemId = v; setEditDetails(nd) }}>
                          <SelectTrigger className="text-xs truncate"><SelectValue placeholder="품목 선택" /></SelectTrigger>
                          <SelectContent className="max-w-[calc(100vw-4rem)]">{items.map((it: any) => <SelectItem key={it.id} value={it.id}><span className="truncate">{it.itemCode} - {it.itemName}</span></SelectItem>)}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-3 gap-2 min-w-0">
                          <div className="space-y-1"><Label className="text-[11px]">수량</Label><Input type="number" className="text-xs" value={d.quantity || ''} onChange={e => { const nd = [...editDetails]; nd[idx].quantity = parseFloat(e.target.value) || 0; setEditDetails(nd) }} /></div>
                          <div className="space-y-1"><Label className="text-[11px]">단가</Label><Input type="number" className="text-xs" value={d.unitPrice || ''} onChange={e => { const nd = [...editDetails]; nd[idx].unitPrice = parseFloat(e.target.value) || 0; setEditDetails(nd) }} /></div>
                          <div className="space-y-1"><Label className="text-[11px]">합계(부가세 포함)</Label><div className="h-9 flex items-center justify-end px-2 rounded-md border bg-muted/50 font-mono text-xs font-medium">{formatCurrency(supply + editTax)}</div></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={editMutation.isPending}>{editMutation.isPending ? '수정 중...' : '발주 수정'}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 완료 처리 Dialog (배차정보/담당자 입력) */}
      <Dialog open={!!completeTarget} onOpenChange={(v) => !v && setCompleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>발주 완료 처리 - {completeTarget?.orderNo}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const dispatchInfo = form.get('dispatchInfo') as string
            const receivedBy = form.get('receivedBy') as string
            if (!dispatchInfo || !receivedBy) { toast.error('배차정보와 담당자를 입력해주세요.'); return }
            completeMutation.mutate({ id: completeTarget.id, dispatchInfo, receivedBy })
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>배차정보 *</Label>
              <Input name="dispatchInfo" required placeholder="차량번호, 운송업체 등" defaultValue={completeTarget?.dispatchInfo || ''} />
            </div>
            <div className="space-y-2">
              <Label>발주 담당자 *</Label>
              <Input name="receivedBy" required placeholder="담당자 이름" defaultValue={completeTarget?.receivedBy || ''} />
            </div>
            <Button type="submit" className="w-full" disabled={completeMutation.isPending}>
              {completeMutation.isPending ? '처리 중...' : '완료 처리'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 일괄 완료 처리 Dialog */}
      <Dialog open={batchCompleteOpen} onOpenChange={(v) => { if (!v) { setBatchCompleteOpen(false); setBatchCompleteIds([]) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>일괄 완료 처리 ({batchCompleteIds.length}건)</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            const dispatchInfo = form.get('dispatchInfo') as string
            const receivedBy = form.get('receivedBy') as string
            if (!dispatchInfo || !receivedBy) { toast.error('배차정보와 담당자를 입력해주세요.'); return }
            batchMutation.mutate({ ids: batchCompleteIds, action: 'complete', dispatchInfo, receivedBy })
          }} className="space-y-4">
            <p className="text-sm text-muted-foreground">선택한 {batchCompleteIds.length}건의 발주를 일괄 완료 처리합니다.</p>
            <div className="space-y-2">
              <Label>배차정보 *</Label>
              <Input name="dispatchInfo" required placeholder="차량번호, 운송업체 등" />
            </div>
            <div className="space-y-2">
              <Label>발주 담당자 *</Label>
              <Input name="receivedBy" required placeholder="담당자 이름" />
            </div>
            <Button type="submit" className="w-full" disabled={batchMutation.isPending}>
              {batchMutation.isPending ? '처리 중...' : `${batchCompleteIds.length}건 완료 처리`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
