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
import { generateTransactionStatementPDF, type TransactionStatementPDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, FileDown, Paperclip, FileText } from 'lucide-react'
import { RecordSubTabs, savePendingData } from '@/components/common/record-sub-tabs'

const STATUS_MAP: Record<string, string> = { PREPARING: '준비중', SHIPPED: '출하', DELIVERED: '납품완료' }

interface Detail {
  itemId: string
  quantity: number
  unitPrice: number
}

interface TrackingRow {
  deliveryNo: string
  carrier: string
  trackingNo: string
}

export default function DeliveriesPage() {
  const [activeTab, setActiveTab] = useState<string>('ONLINE')

  const handleStatementPDF = (delivery: any) => {
    const details = delivery.details || []
    const totalAmount = details.reduce((s: number, d: any) => s + Number(d.amount), 0)
    const pdfData: TransactionStatementPDFData = {
      statementNo: delivery.deliveryNo,
      statementDate: formatDate(delivery.deliveryDate),
      supplier: { name: COMPANY_NAME },
      buyer: { name: delivery.partner?.partnerName || '' },
      items: details.map((d: any, i: number) => ({
        no: i + 1,
        itemName: d.item?.itemName || '',
        spec: d.item?.specification || '',
        qty: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        amount: Number(d.amount),
      })),
      totalAmount,
    }
    generateTransactionStatementPDF(pdfData)
    toast.success('거래명세표 PDF가 다운로드되었습니다.')
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'deliveryNo',
      header: '납품번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.deliveryNo}</span>,
    },
    { id: 'deliveryDate', header: '납품일', cell: ({ row }) => formatDate(row.original.deliveryDate) },
    {
      id: 'orderNo',
      header: '발주번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrder?.orderNo || '-'}</span>,
    },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'detailCount', header: '품목수', cell: ({ row }) => `${row.original.details?.length || 0}건` },
    {
      id: 'total',
      header: '합계',
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.original.details?.reduce((s: number, d: any) => s + Number(d.amount), 0) || 0)}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <Badge variant="outline">{STATUS_MAP[row.original.status] || row.original.status}</Badge>,
    },
    {
      id: 'trackingNo',
      header: '운송장번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.trackingNo || '-'}</span>,
    },
    { id: 'carrier', header: '택배사', cell: ({ row }) => row.original.carrier || '-' },
    {
      id: 'pdf',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleStatementPDF(row.original)}
          title="거래명세표 PDF"
          aria-label="거래명세표 PDF 다운로드"
        >
          <FileDown className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const exportColumns: ExportColumn[] = [
    { header: '납품번호', accessor: 'deliveryNo' },
    { header: '납품일', accessor: (r) => (r.deliveryDate ? formatDate(r.deliveryDate) : '') },
    { header: '발주번호', accessor: (r) => r.salesOrder?.orderNo || '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '품목수', accessor: (r) => `${r.details?.length || 0}건` },
    {
      header: '합계',
      accessor: (r) => formatCurrency(r.details?.reduce((s: number, d: any) => s + Number(d.amount), 0) || 0),
    },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status] || r.status },
    { header: '운송장번호', accessor: (r) => r.trackingNo || '' },
    { header: '택배사', accessor: (r) => r.carrier || '' },
  ]

  const [open, setOpen] = useState(false)
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [details, setDetails] = useState<Detail[]>([{ itemId: '', quantity: 1, unitPrice: 0 }])
  const [trackingRows, setTrackingRows] = useState<TrackingRow[]>([])
  const [trackingResult, setTrackingResult] = useState<{
    total: number
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingNote, setPendingNote] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Fetch deliveries filtered by salesChannel (ONLINE or OFFLINE)
  const { data: onlineData, isLoading: onlineLoading } = useQuery({
    queryKey: ['sales-deliveries', 'ONLINE'],
    queryFn: () => api.get('/sales/deliveries?pageSize=50&salesChannel=ONLINE') as Promise<any>,
  })
  const { data: offlineData, isLoading: offlineLoading } = useQuery({
    queryKey: ['sales-deliveries', 'OFFLINE'],
    queryFn: () => api.get('/sales/deliveries?pageSize=50&salesChannel=OFFLINE') as Promise<any>,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-active'],
    queryFn: () => api.get('/sales/orders?status=ORDERED&pageSize=200') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })
  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any>,
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/deliveries', body),
    onSuccess: async (res: any) => {
      const record = res.data || res
      if (record?.id && (pendingFiles.length > 0 || pendingNote.trim())) {
        await savePendingData('Delivery', record.id, pendingFiles, pendingNote)
      }
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setOpen(false)
      setDetails([{ itemId: '', quantity: 1, unitPrice: 0 }])
      setPendingFiles([])
      setPendingNote('')
      toast.success('납품이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const trackingMutation = useMutation({
    mutationFn: (body: { trackings: TrackingRow[] }) => api.post('/sales/deliveries/tracking', body),
    onSuccess: (res: any) => {
      const result = res.data || res
      setTrackingResult(result)
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      toast.success(`운송장 업로드 완료: 성공 ${result.success}건, 실패 ${result.failed}건`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const orders = ordersData?.data || []
  const items = itemsData?.data || []
  const onlineDeliveries = onlineData?.data || []
  const offlineDeliveries = offlineData?.data || []

  const updateDetail = (idx: number, field: string, value: any) => {
    const d = [...details]
    ;(d[idx] as any)[field] = value
    setDetails(d)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      deliveryDate: form.get('deliveryDate'),
      salesOrderId: form.get('salesOrderId'),
      deliveryAddress: form.get('deliveryAddress') || undefined,
      carrier: form.get('carrier') || undefined,
      trackingNo: form.get('trackingNo') || undefined,
      details: details.filter((d) => d.itemId),
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
      const rows = await readExcelFile(file, {
        납품번호: 'deliveryNo',
        택배사: 'carrier',
        운송장번호: 'trackingNo',
      })
      setTrackingRows(rows as TrackingRow[])
      setTrackingResult(null)
    } catch (err) {
      toast.error('엑셀 파일을 읽을 수 없습니다.')
    }

    // reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTrackingUpload = () => {
    if (trackingRows.length === 0) {
      toast.error('업로드할 데이터가 없습니다.')
      return
    }
    trackingMutation.mutate({ trackings: trackingRows })
  }

  const handleExport = (type: 'excel' | 'pdf') => {
    const currentDeliveries = activeTab === 'ONLINE' ? onlineDeliveries : offlineDeliveries
    const tabLabel = activeTab === 'ONLINE' ? '온라인' : '오프라인'
    const cfg = {
      fileName: `납품목록_${tabLabel}`,
      title: `납품관리 목록 (${tabLabel})`,
      columns: exportColumns,
      data: currentDeliveries,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  // Shared create dialog (appears on both tabs)
  const createDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>납품 등록</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>납품 등록 ({activeTab === 'ONLINE' ? '온라인' : '오프라인'})</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <Tabs defaultValue="info">
            <TabsList variant="line">
              <TabsTrigger value="info">기본 정보</TabsTrigger>
              <TabsTrigger value="files">
                <Paperclip className="mr-1 h-3.5 w-3.5" />
                특이사항{pendingFiles.length > 0 && <span className="ml-1 text-xs">({pendingFiles.length})</span>}
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="mr-1 h-3.5 w-3.5" />
                게시글
              </TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    납품일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="deliveryDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>
                    발주 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="salesOrderId">
                    <SelectTrigger>
                      <SelectValue placeholder="발주 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((o: any) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.orderNo} - {o.partner?.partnerName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {activeTab === 'ONLINE' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>택배사</Label>
                    <Input name="carrier" placeholder="CJ대한통운, 한진택배 등" />
                  </div>
                  <div className="space-y-2">
                    <Label>운송장번호</Label>
                    <Input name="trackingNo" placeholder="운송장번호 입력" />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>납품주소</Label>
                <Input name="deliveryAddress" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>품목</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetails([...details, { itemId: '', quantity: 1, unitPrice: 0 }])}
                  >
                    <Plus className="mr-1 h-3 w-3" /> 행 추가
                  </Button>
                </div>
                <div className="space-y-3">
                  {details.map((d, idx) => (
                    <div key={idx} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs font-medium">품목 #{idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => details.length > 1 && setDetails(details.filter((_, i) => i !== idx))}
                          disabled={details.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <Select value={d.itemId} onValueChange={(v) => updateDetail(idx, 'itemId', v)}>
                        <SelectTrigger className="truncate text-xs">
                          <SelectValue placeholder="품목 선택" />
                        </SelectTrigger>
                        <SelectContent className="max-w-[calc(100vw-4rem)]">
                          {items.map((it: any) => (
                            <SelectItem key={it.id} value={it.id}>
                              <span className="truncate">
                                {it.itemCode} - {it.itemName}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid min-w-0 grid-cols-3 gap-2">
                        <div className="min-w-0 space-y-1">
                          <Label className="text-[11px]">수량</Label>
                          <Input
                            type="number"
                            className="text-xs"
                            value={d.quantity || ''}
                            onChange={(e) => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <Label className="text-[11px]">단가</Label>
                          <Input
                            type="number"
                            className="text-xs"
                            value={d.unitPrice || ''}
                            onChange={(e) => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <Label className="text-[11px]">금액</Label>
                          <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs">
                            {formatCurrency(d.quantity * d.unitPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <RecordSubTabs
              relatedTable="Delivery"
              pendingFiles={pendingFiles}
              onPendingFilesChange={setPendingFiles}
              pendingNote={pendingNote}
              onPendingNoteChange={setPendingNote}
            />
          </Tabs>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? '등록 중...' : '납품 등록'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )

  // Tracking upload dialog (only for online tab)
  const trackingDialog = (
    <Dialog
      open={trackingOpen}
      onOpenChange={(v) => {
        setTrackingOpen(v)
        if (!v) {
          setTrackingRows([])
          setTrackingResult(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          운송장 업로드
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>운송장 일괄 업로드</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
              템플릿 다운로드
            </Button>
            <div className="flex-1">
              <Input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileSelect} />
            </div>
          </div>

          {trackingRows.length > 0 && (
            <div className="space-y-2">
              <Label>미리보기 (최대 5건)</Label>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="p-2 text-left">납품번호</th>
                      <th className="p-2 text-left">택배사</th>
                      <th className="p-2 text-left">운송장번호</th>
                    </tr>
                  </thead>
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
              {trackingRows.length > 5 && (
                <p className="text-muted-foreground text-sm">외 {trackingRows.length - 5}건</p>
              )}
              <Button className="w-full" onClick={handleTrackingUpload} disabled={trackingMutation.isPending}>
                {trackingMutation.isPending ? '업로드 중...' : `업로드 (${trackingRows.length}건)`}
              </Button>
            </div>
          )}

          {trackingResult && (
            <div className="space-y-2 rounded-md border p-4">
              <div className="flex items-center gap-4 text-sm">
                <span>
                  전체: <strong>{trackingResult.total}건</strong>
                </span>
                <span className="text-green-600">
                  성공: <strong>{trackingResult.success}건</strong>
                </span>
                <span className="text-red-600">
                  실패: <strong>{trackingResult.failed}건</strong>
                </span>
              </div>
              {trackingResult.errors.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-red-600">오류 목록</Label>
                  <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-600">
                    {trackingResult.errors.map((err, idx) => (
                      <p key={idx}>{err}</p>
                    ))}
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
      <PageHeader title="납품관리" description="고객 납품 현황을 관리합니다" />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ONLINE">온라인</TabsTrigger>
          <TabsTrigger value="OFFLINE">오프라인</TabsTrigger>
        </TabsList>

        <TabsContent value="ONLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              {createDialog}
              {trackingDialog}
            </div>
            <DataTable
              columns={columns}
              data={onlineDeliveries}
              searchColumn="deliveryNo"
              searchPlaceholder="납품번호로 검색..."
              isLoading={onlineLoading}
              pageSize={50}
              onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
            />
          </div>
        </TabsContent>

        <TabsContent value="OFFLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">{createDialog}</div>
            <DataTable
              columns={columns}
              data={offlineDeliveries}
              searchColumn="deliveryNo"
              searchPlaceholder="납품번호로 검색..."
              isLoading={offlineLoading}
              pageSize={50}
              onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
