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
import {
  generateTaxInvoicePDF,
  generateTransactionStatementPDF,
  type TaxInvoicePDFData,
  type TransactionStatementPDFData,
} from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  FileDown,
  Upload,
  Pencil,
  Download,
  FileText,
  Search,
  Filter,
  RotateCcw,
  Paperclip,
} from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Textarea } from '@/components/ui/textarea'
import { RecordSubTabs } from '@/components/common/record-sub-tabs'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  ORDERED: { label: '발주', variant: 'default' },
  IN_PROGRESS: { label: '진행중', variant: 'secondary' },
  COMPLETED: { label: '완료', variant: 'outline' },
  CANCELLED: { label: '취소', variant: 'destructive' },
  COMPLAINT: { label: '컨플레인', variant: 'destructive' },
  EXCHANGE: { label: '교환', variant: 'secondary' },
  RETURN: { label: '반품', variant: 'destructive' },
}

interface Detail {
  itemId: string
  quantity: number
  unitPrice: number
  carrier: string
  trackingNo: string
  description: string
}

interface OrderRow {
  orderDate: string
  barcode: string
  orderNumber: string
  siteName: string
  itemId: string
  productName: string
  quantity: number
  orderer: string
  recipient: string
  ordererContact: string
  recipientContact: string
  zipCode: string
  address: string
  requirements: string
  trackingNo: string
  senderName: string
  senderPhone: string
  senderAddress: string
  shippingCost: number
  specialNote: string
}

const emptyOrderRow = (company?: any): OrderRow => ({
  orderDate: new Date().toISOString().split('T')[0],
  barcode: '',
  orderNumber: '',
  siteName: '',
  itemId: '',
  productName: '',
  quantity: 1,
  orderer: '',
  recipient: '',
  ordererContact: '',
  recipientContact: '',
  zipCode: '',
  address: '',
  requirements: '',
  trackingNo: '',
  senderName: company?.companyName || '',
  senderPhone: company?.phone || '',
  senderAddress: company?.address || '',
  shippingCost: 0,
  specialNote: '',
})

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
  const [cancelTarget, setCancelTarget] = useState<{ id: string; orderNo: string } | null>(null)
  const [batchCancelConfirm, setBatchCancelConfirm] = useState<string[] | null>(null)
  const [vatIncluded, setVatIncluded] = useState(true)
  const [details, setDetails] = useState<Detail[]>([
    { itemId: '', quantity: 1, unitPrice: 0, carrier: '', trackingNo: '', description: '' },
  ])
  const [orderRows, setOrderRows] = useState<OrderRow[]>([])
  const [createPartnerSearch, setCreatePartnerSearch] = useState('')
  const [trackingRows, setTrackingRows] = useState<TrackingRow[]>([])
  const [trackingResult, setTrackingResult] = useState<{
    total: number
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // 캐싱된 회사 정보에서 기본 회사 가져오기
  const getCompanyInfo = () => {
    const companies = companyData?.data || []
    const defaultCompany = companies.find((c: any) => c.isDefault) || companies[0]
    if (defaultCompany) {
      return {
        name: defaultCompany.companyName,
        bizNo: defaultCompany.bizNo || '',
        ceo: defaultCompany.ceoName || '',
        address: defaultCompany.address || '',
        bizType: defaultCompany.bizType || '',
        bizItem: defaultCompany.bizCategory || '',
        tel: defaultCompany.phone || '',
      }
    }
    return { name: COMPANY_NAME, bizNo: '', ceo: '', address: '', bizType: '', bizItem: '', tel: '' }
  }

  const handleTaxInvoicePDF = async (order: any) => {
    let orderDetail = order
    try {
      const res = (await api.get(`/sales/orders/${order.id}`)) as any
      orderDetail = res.data || res
    } catch {
      toast.error('주문 상세 정보를 불러올 수 없습니다.')
      return
    }
    const orderDate = new Date(orderDetail.orderDate)
    const ci = getCompanyInfo()
    const pdfData: TaxInvoicePDFData = {
      invoiceNo: orderDetail.orderNo,
      invoiceDate: formatDate(orderDetail.orderDate),
      supplier: {
        name: ci.name,
        bizNo: ci.bizNo,
        ceo: ci.ceo,
        address: ci.address,
        bizType: ci.bizType,
        bizItem: ci.bizItem,
      },
      buyer: {
        name: orderDetail.partner?.partnerName || '',
        bizNo: orderDetail.partner?.bizNo || '',
        ceo: orderDetail.partner?.ceoName || '',
        address: orderDetail.partner?.address || '',
      },
      items: (orderDetail.details || []).map((d: any) => ({
        month: String(orderDate.getMonth() + 1),
        day: String(orderDate.getDate()),
        itemName: d.item?.itemName || '',
        spec: d.item?.specification || '',
        qty: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        supplyAmount: Number(d.supplyAmount),
        taxAmount: Number(d.taxAmount),
      })),
      totalSupply: Number(orderDetail.totalSupply),
      totalTax: Number(orderDetail.totalTax),
      totalAmount: Number(orderDetail.totalAmount),
    }
    generateTaxInvoicePDF(pdfData)
    toast.success('세금계산서 PDF가 다운로드되었습니다.')
  }

  // 거래명세표 PDF
  const handleTransactionStatementPDF = async (order: any) => {
    let orderDetail = order
    try {
      const res = (await api.get(`/sales/orders/${order.id}`)) as any
      orderDetail = res.data || res
    } catch {
      toast.error('주문 상세 정보를 불러올 수 없습니다.')
      return
    }
    const ci = getCompanyInfo()
    const pdfData: TransactionStatementPDFData = {
      statementNo: orderDetail.orderNo,
      statementDate: formatDate(orderDetail.orderDate),
      supplier: { name: ci.name, bizNo: ci.bizNo, ceo: ci.ceo, address: ci.address, tel: ci.tel },
      buyer: {
        name: orderDetail.partner?.partnerName || '',
        bizNo: orderDetail.partner?.bizNo || '',
        ceo: orderDetail.partner?.ceoName || '',
        address: orderDetail.partner?.address || '',
        tel: orderDetail.partner?.phone || '',
      },
      items: (orderDetail.details || []).map((d: any, idx: number) => ({
        no: idx + 1,
        itemName: d.item?.itemName || '',
        spec: d.item?.specification || '',
        qty: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        amount: Number(d.supplyAmount),
        remark: d.remark || '',
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setEditTarget(null)
      toast.success('발주가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })
  const handleEdit = async (order: any) => {
    try {
      const res = (await api.get(`/sales/orders/${order.id}`)) as any
      const detail = res.data || res
      setEditTarget(detail)
      setEditDetails(
        (detail.details || []).map((d: any) => ({
          itemId: d.itemId || d.item?.id,
          quantity: Number(d.quantity),
          unitPrice: Number(d.unitPrice),
          carrier: '',
          trackingNo: '',
          description: '',
        }))
      )
    } catch {
      toast.error('주문 상세를 불러올 수 없습니다.')
    }
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
      details: editDetails.filter((d) => d.itemId),
    })
  }

  // 완료 처리 (배차정보/담당자 필요)
  const [completeTarget, setCompleteTarget] = useState<any>(null)
  const completeMutation = useMutation({
    mutationFn: ({ id, dispatchInfo, receivedBy }: { id: string; dispatchInfo: string; receivedBy: string }) =>
      api.put(`/sales/orders/${id}`, { action: 'complete', dispatchInfo, receivedBy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setCompleteTarget(null)
      toast.success('발주가 완료 처리되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/sales/orders/${id}`, { action: 'cancel' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('발주가 취소 처리되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      toast.success('발주가 삭제되었습니다.')
    },
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
    {
      accessorKey: 'orderNo',
      header: '발주번호',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.orderNo}</span>,
    },
    { id: 'orderDate', header: '발주일', cell: ({ row }) => formatDate(row.original.orderDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    {
      id: 'deliveryDate',
      header: '납기일',
      cell: ({ row }) => (row.original.deliveryDate ? formatDate(row.original.deliveryDate) : '-'),
    },
    {
      id: 'totalAmount',
      header: '합계금액',
      cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>,
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status
      },
    },
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
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="더보기 메뉴">
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
                <DropdownMenuItem
                  onClick={() => setCancelTarget({ id: row.original.id, orderNo: row.original.orderNo })}
                  disabled={cancelMutation.isPending}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  취소 처리
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(row.original.id, row.original.orderNo)}
                disabled={deleteMutation.isPending}
              >
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
    const y = now.getFullYear(),
      m = now.getMonth(),
      d = now.getDate()
    switch (preset) {
      case 'today':
        return {
          start: new Date(y, m, d).toISOString().split('T')[0],
          end: new Date(y, m, d).toISOString().split('T')[0],
        }
      case 'thisWeek': {
        const dow = now.getDay()
        const s = new Date(y, m, d - dow)
        return { start: s.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
      }
      case 'thisMonth':
        return {
          start: new Date(y, m, 1).toISOString().split('T')[0],
          end: new Date(y, m + 1, 0).toISOString().split('T')[0],
        }
      case 'lastMonth':
        return {
          start: new Date(y, m - 1, 1).toISOString().split('T')[0],
          end: new Date(y, m, 0).toISOString().split('T')[0],
        }
      case 'last3Months':
        return {
          start: new Date(y, m - 2, 1).toISOString().split('T')[0],
          end: new Date(y, m + 1, 0).toISOString().split('T')[0],
        }
      case 'thisYear':
        return {
          start: new Date(y, 0, 1).toISOString().split('T')[0],
          end: new Date(y, 11, 31).toISOString().split('T')[0],
        }
      default:
        return { start: '', end: '' }
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
    if (dateFilter === 'monthly' && filterMonth) {
      qp.set('startDate', `${filterMonth}-01`)
      const [fy, fm] = filterMonth.split('-').map(Number)
      const lastDay = new Date(fy, fm, 0).getDate()
      qp.set('endDate', `${filterMonth}-${String(lastDay).padStart(2, '0')}`)
    }
    if (dateFilter === 'daily' && filterDate) {
      qp.set('startDate', filterDate)
      qp.set('endDate', filterDate)
    }
    if (partnerFilter && partnerFilter !== 'all') qp.set('partnerId', partnerFilter)
    if (searchKeyword) qp.set('search', searchKeyword)
    return qp
  }

  const qpOnline = buildQueryParams('ONLINE')
  const qpOffline = buildQueryParams('OFFLINE')

  const { data: onlineData, isLoading: onlineLoading } = useQuery({
    queryKey: [
      'sales-orders',
      'ONLINE',
      statusFilter,
      filterMonth,
      filterDate,
      dateFilter,
      datePreset,
      partnerFilter,
      searchKeyword,
    ],
    queryFn: () => api.get(`/sales/orders?${qpOnline}`) as Promise<any>,
  })
  const { data: offlineData, isLoading: offlineLoading } = useQuery({
    queryKey: [
      'sales-orders',
      'OFFLINE',
      statusFilter,
      filterMonth,
      filterDate,
      dateFilter,
      datePreset,
      partnerFilter,
      searchKeyword,
    ],
    queryFn: () => api.get(`/sales/orders?${qpOffline}`) as Promise<any>,
  })
  const { data: partnersData } = useQuery({
    queryKey: ['partners-sales'],
    queryFn: () => api.get('/partners?pageSize=500') as Promise<any>,
    staleTime: 10 * 60 * 1000,
  })
  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<any>,
    staleTime: 10 * 60 * 1000,
  })
  const { data: companyData } = useQuery({
    queryKey: ['admin-company'],
    queryFn: () => api.get('/admin/company') as Promise<any>,
    staleTime: 30 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/orders', body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setOpen(false)
      setDetails([{ itemId: '', quantity: 1, unitPrice: 0, carrier: '', trackingNo: '', description: '' }])
      setVatIncluded(true)
      toast.success('발주가 등록되었습니다.')
    },
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
    { header: '발주일', accessor: (r) => (r.orderDate ? formatDate(r.orderDate) : '') },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '납기일', accessor: (r) => (r.deliveryDate ? formatDate(r.deliveryDate) : '') },
    { header: '합계(부가세 포함)', accessor: (r) => (r.totalAmount ? formatCurrency(r.totalAmount) : '') },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const currentOrders = activeTab === 'ONLINE' ? onlineOrders : offlineOrders
    const tabLabel = activeTab === 'ONLINE' ? '온라인' : '오프라인'
    const cfg = {
      fileName: `발주목록_${tabLabel}`,
      title: `발주관리 목록 (${tabLabel})`,
      columns: exportColumns,
      data: currentOrders,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const updateDetail = (idx: number, field: string, value: any) => {
    const d = [...details]
    ;(d[idx] as any)[field] = value
    setDetails(d)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      orderDate: form.get('orderDate'),
      partnerId: form.get('partnerId'),
      salesChannel: activeTab,
      vatIncluded,
      deliveryDate: form.get('deliveryDate') || undefined,
      description: details[0]?.description || undefined,
      details: details
        .filter((d) => d.itemId)
        .map(({ itemId, quantity, unitPrice }) => ({ itemId, quantity, unitPrice })),
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

  const handleOrderTemplateDownload = () => {
    const cols = [
      { header: '주문일', key: 'orderDate', example: '2026-02-24', width: 14, required: true },
      { header: '상품바코드', key: 'barcode', example: '8801234567890', width: 16 },
      { header: '주문번호', key: 'orderNumber', example: '', width: 16 },
      { header: '사이트명', key: 'siteName', example: '쿠팡', width: 12 },
      { header: '상품명', key: 'productName', example: '상품명', width: 20, required: true },
      { header: '수량', key: 'quantity', example: '1', width: 8, required: true },
      { header: '주문자', key: 'orderer', example: '홍길동', width: 12 },
      { header: '수취인', key: 'recipient', example: '김철수', width: 12 },
      { header: '주문자 연락처', key: 'ordererContact', example: '010-1234-5678', width: 16 },
      { header: '수취인 연락처', key: 'recipientContact', example: '010-9876-5432', width: 16 },
      { header: '우편번호', key: 'zipCode', example: '06234', width: 10 },
      { header: '주소', key: 'address', example: '서울시 강남구 역삼동 123-45', width: 30 },
      { header: '요구사항', key: 'requirements', example: '부재시 경비실', width: 20 },
      { header: '운송장번호', key: 'trackingNo', example: '1234567890', width: 16 },
      { header: '보내는사람(업체명)', key: 'senderName', example: getCompanyInfo().name, width: 18 },
      { header: '전화번호', key: 'senderPhone', example: getCompanyInfo().tel, width: 14 },
      { header: '주소', key: 'senderAddress', example: getCompanyInfo().address, width: 30 },
      { header: '운임', key: 'shippingCost', example: '3000', width: 10 },
      { header: '특기사항', key: 'specialNote', example: '', width: 20 },
    ]
    downloadImportTemplate({ fileName: '발주_등록_템플릿', sheetName: '발주', columns: cols })
  }

  const orderImportFileRef = useRef<HTMLInputElement>(null)
  const handleOrderImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const keyMap: Record<string, string> = {
        주문일: 'orderDate',
        상품바코드: 'barcode',
        주문번호: 'orderNumber',
        사이트명: 'siteName',
        상품명: 'productName',
        수량: 'quantity',
        주문자: 'orderer',
        수취인: 'recipient',
        '주문자 연락처': 'ordererContact',
        '수취인 연락처': 'recipientContact',
        우편번호: 'zipCode',
        주소: 'address',
        요구사항: 'requirements',
        운송장번호: 'trackingNo',
        '보내는사람(업체명)': 'senderName',
        전화번호: 'senderPhone',
        운임: 'shippingCost',
        특기사항: 'specialNote',
      }
      const rows = await readExcelFile(file, keyMap)
      if (rows.length === 0) {
        toast.error('데이터가 없습니다.')
        return
      }

      let successCount = 0
      let failCount = 0
      const failReasons: string[] = []
      const normalize = (s: any) => (s ? String(s).trim().toLowerCase() : '')
      for (const row of rows) {
        const barcodeVal = normalize(row.barcode)
        const productVal = normalize(row.productName)
        // 품목 매칭: 바코드(정확) → 품목명(포함) → 품목코드(포함)
        const item =
          items.find(
            (it: any) =>
              (barcodeVal && normalize(it.barcode) === barcodeVal) ||
              (productVal && normalize(it.itemName) === productVal) ||
              (productVal && normalize(it.itemCode) === productVal)
          ) ||
          items.find(
            (it: any) =>
              (productVal && normalize(it.itemName).includes(productVal)) ||
              (productVal && normalize(it.itemCode).includes(productVal))
          )
        if (!item) {
          failCount++
          failReasons.push(`상품명 "${row.productName || row.barcode}" 미매칭`)
          continue
        }
        try {
          await api.post('/sales/orders', {
            orderDate: row.orderDate || new Date().toISOString().split('T')[0],
            salesChannel: activeTab,
            vatIncluded: true,
            siteName: row.siteName || undefined,
            ordererName: row.orderer || undefined,
            recipientName: row.recipient || undefined,
            ordererContact: row.ordererContact || undefined,
            recipientContact: row.recipientContact || undefined,
            recipientZipCode: row.zipCode || undefined,
            recipientAddress: row.address || undefined,
            requirements: row.requirements || undefined,
            trackingNo: row.trackingNo || undefined,
            senderName: row.senderName || undefined,
            senderPhone: row.senderPhone || undefined,
            senderAddress: row.senderAddress || undefined,
            shippingCost: row.shippingCost ? Number(row.shippingCost) : undefined,
            specialNote: row.specialNote || undefined,
            details: [
              {
                itemId: item.id,
                quantity: Number(row.quantity) || 1,
                unitPrice: item.standardPrice ? Number(item.standardPrice) : 0,
              },
            ],
          })
          successCount++
        } catch {
          failCount++
        }
      }
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      if (failReasons.length > 0) {
        toast.error(
          `${successCount}건 등록, ${failCount}건 실패: ${failReasons.slice(0, 3).join(', ')}${failReasons.length > 3 ? ' ...' : ''}`
        )
      } else {
        toast.success(`${successCount}건 등록 완료`)
      }
    } catch (err: any) {
      toast.error(err.message || '엑셀 파일을 읽을 수 없습니다.')
    }
    if (orderImportFileRef.current) orderImportFileRef.current.value = ''
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file, { 납품번호: 'deliveryNo', 택배사: 'carrier', 운송장번호: 'trackingNo' })
      setTrackingRows(rows as TrackingRow[])
      setTrackingResult(null)
    } catch (err) {
      toast.error('엑셀 파일을 읽을 수 없습니다.')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTrackingUpload = () => {
    if (trackingRows.length === 0) {
      toast.error('업로드할 데이터가 없습니다.')
      return
    }
    trackingMutation.mutate({ trackings: trackingRows })
  }

  const getDefaultCompany = () => {
    const companies = companyData?.data || []
    return companies.find((c: any) => c.isDefault) || companies[0] || null
  }

  const updateOrderRow = (idx: number, field: keyof OrderRow, value: any) => {
    const rows = [...orderRows]
    ;(rows[idx] as any)[field] = value
    setOrderRows(rows)
  }

  const handleCreateOrder = () => {
    if (orderRows.length === 0) {
      toast.error('등록할 데이터가 없습니다.')
      return
    }
    const missingItems = orderRows.filter((r) => !r.itemId)
    if (missingItems.length > 0) {
      toast.error('모든 행에 품목을 선택해주세요.')
      return
    }
    const processRows = async () => {
      let successCount = 0
      let failCount = 0
      const failReasons: string[] = []
      for (const row of orderRows) {
        const item = items.find((it: any) => it.id === row.itemId)
        if (!item) {
          failCount++
          failReasons.push(`품목 ID "${row.itemId}" 미매칭`)
          continue
        }
        try {
          await api.post('/sales/orders', {
            orderDate: row.orderDate || new Date().toISOString().split('T')[0],
            salesChannel: activeTab,
            vatIncluded: true,
            siteName: row.siteName || undefined,
            ordererName: row.orderer || undefined,
            recipientName: row.recipient || undefined,
            ordererContact: row.ordererContact || undefined,
            recipientContact: row.recipientContact || undefined,
            recipientZipCode: row.zipCode || undefined,
            recipientAddress: row.address || undefined,
            requirements: row.requirements || undefined,
            trackingNo: row.trackingNo || undefined,
            senderName: row.senderName || undefined,
            senderPhone: row.senderPhone || undefined,
            senderAddress: row.senderAddress || undefined,
            shippingCost: row.shippingCost ? Number(row.shippingCost) : undefined,
            specialNote: row.specialNote || undefined,
            details: [
              { itemId: item.id, quantity: Number(row.quantity) || 1, unitPrice: Number(item.standardPrice) || 0 },
            ],
          })
          successCount++
        } catch {
          failCount++
        }
      }
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      setOpen(false)
      setOrderRows([])
      if (failCount > 0) {
        toast.error(
          `${successCount}건 등록, ${failCount}건 실패${failReasons.length > 0 ? ': ' + failReasons.slice(0, 3).join(', ') : ''}`
        )
      } else {
        toast.success(`${successCount}건 등록 완료`)
      }
    }
    processRows()
  }

  // 19열 컬럼 정의
  const orderColDefs: {
    key: keyof OrderRow
    label: string
    width: string
    type?: 'date' | 'number'
    required?: boolean
    highlight?: boolean
  }[] = [
    { key: 'orderDate', label: '주문일', width: 'w-[100px]', type: 'date', required: true },
    { key: 'barcode', label: '상품바코드', width: 'w-[110px]' },
    { key: 'orderNumber', label: '주문번호', width: 'w-[100px]' },
    { key: 'siteName', label: '사이트명', width: 'w-[90px]' },
    { key: 'productName', label: '상품명', width: 'w-[120px]', required: true },
    { key: 'quantity', label: '수량', width: 'w-[60px]', type: 'number', required: true },
    { key: 'orderer', label: '주문자', width: 'w-[80px]' },
    { key: 'recipient', label: '수취인', width: 'w-[80px]' },
    { key: 'ordererContact', label: '주문자 연락처', width: 'w-[110px]' },
    { key: 'recipientContact', label: '수취인 연락처', width: 'w-[110px]' },
    { key: 'zipCode', label: '우편번호', width: 'w-[80px]' },
    { key: 'address', label: '주소', width: 'w-[160px]' },
    { key: 'requirements', label: '요구사항', width: 'w-[120px]' },
    { key: 'trackingNo', label: '운송장번호', width: 'w-[110px]' },
    { key: 'senderName', label: '보내는사람(업체명)', width: 'w-[120px]', highlight: true },
    { key: 'senderPhone', label: '전화번호', width: 'w-[100px]', highlight: true },
    { key: 'senderAddress', label: '주소', width: 'w-[160px]', highlight: true },
    { key: 'shippingCost', label: '운임', width: 'w-[80px]', type: 'number', highlight: true },
    { key: 'specialNote', label: '특기사항', width: 'w-[120px]', highlight: true },
  ]

  // ── 온라인: 19열 e-커머스 양식 ──
  const onlineCreateDialog = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setOrderRows([])
        }
        if (v && orderRows.length === 0) setOrderRows([emptyOrderRow(getDefaultCompany())])
      }}
    >
      <DialogTrigger asChild>
        <Button>발주 등록</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-[98vw] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>발주 등록 (온라인)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground text-xs">노란색 영역(보내는사람~특기사항)은 업체정보 자동입력</p>
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setOrderRows([...orderRows, emptyOrderRow(getDefaultCompany())])}
            >
              <Plus className="mr-1 h-3 w-3" /> 행 추가
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {orderColDefs.map((col) => (
                    <th
                      key={col.key}
                      className={`px-1.5 py-2 text-left font-medium whitespace-nowrap ${col.highlight ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-muted/50'}`}
                    >
                      {col.label}
                      {col.required && <span className="text-destructive"> *</span>}
                    </th>
                  ))}
                  <th className="bg-muted/50 w-8 px-1 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-b-0">
                    {orderColDefs.map((col) => (
                      <td
                        key={col.key}
                        className={`px-0.5 py-1 ${col.highlight ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                      >
                        {col.key === 'productName' ? (
                          <Select
                            value={row.itemId || ''}
                            onValueChange={(v) => {
                              const selectedItem = items.find((it: any) => it.id === v)
                              updateOrderRow(idx, 'itemId', v)
                              updateOrderRow(idx, 'productName', selectedItem?.itemName || '')
                              if (selectedItem?.barcode && !row.barcode) {
                                updateOrderRow(idx, 'barcode', selectedItem.barcode)
                              }
                            }}
                          >
                            <SelectTrigger className={`h-7 ${col.width} text-xs`}>
                              <SelectValue placeholder="품목 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((it: any) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.itemCode} - {it.itemName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={col.type || 'text'}
                            className={`h-7 ${col.width} text-xs`}
                            value={(row as any)[col.key] || ''}
                            onChange={(e) =>
                              updateOrderRow(
                                idx,
                                col.key as keyof OrderRow,
                                col.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                              )
                            }
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-0.5 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => orderRows.length > 1 && setOrderRows(orderRows.filter((_, i) => i !== idx))}
                        disabled={orderRows.length <= 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 border-t">
                  <td colSpan={5} className="px-2 py-2 text-xs font-medium">
                    합계: {orderRows.length}건
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                    {orderRows.reduce((s, r) => s + (r.quantity || 0), 0)}
                  </td>
                  <td colSpan={11}></td>
                  <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                    {formatCurrency(orderRows.reduce((s, r) => s + (r.shippingCost || 0), 0))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <Button className="w-full" onClick={handleCreateOrder} disabled={createMutation.isPending}>
            {createMutation.isPending ? '등록 중...' : `발주 등록 (${orderRows.length}건)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ── 오프라인: 기존 양식 (거래처/품목 드롭다운, 수량/단가/공급가액/세액/합계) ──
  const offlineCreateDialog = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setDetails([{ itemId: '', quantity: 1, unitPrice: 0, carrier: '', trackingNo: '', description: '' }])
      }}
    >
      <DialogTrigger asChild>
        <Button>발주 등록</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>발주 등록 (오프라인)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          {/* 상단 공통 필드 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">
                발주일 <span className="text-destructive">*</span>
              </Label>
              <Input name="orderDate" type="date" required className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                거래처 <span className="text-destructive">*</span>
              </Label>
              <Select name="partnerId" onValueChange={() => setCreatePartnerSearch('')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="거래처 선택" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="거래처명 검색..."
                      value={createPartnerSearch}
                      onChange={(e) => setCreatePartnerSearch(e.target.value)}
                      className="h-7 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {partners
                    .filter(
                      (p: any) =>
                        !createPartnerSearch || p.partnerName.toLowerCase().includes(createPartnerSearch.toLowerCase())
                    )
                    .map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.partnerName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">납기일</Label>
              <Input name="deliveryDate" type="date" className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">부가세</Label>
              <Select value={vatIncluded ? 'true' : 'false'} onValueChange={(v) => setVatIncluded(v === 'true')}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">부가세 포함</SelectItem>
                  <SelectItem value="false">부가세 미포함</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 품목 테이블 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">품목 상세</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  setDetails([
                    ...details,
                    { itemId: '', quantity: 1, unitPrice: 0, carrier: '', trackingNo: '', description: '' },
                  ])
                }
              >
                <Plus className="mr-1 h-3 w-3" /> 행 추가
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[700px] text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">
                      품목명 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">수량</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">단가</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">공급가액</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">세액</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">합계금액</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">비고</th>
                    <th className="w-8 px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, idx) => {
                    const supply = d.quantity * d.unitPrice
                    const itemTaxType = items.find((it: any) => it.id === d.itemId)?.taxType || 'TAXABLE'
                    const tax = vatIncluded && itemTaxType === 'TAXABLE' ? Math.round(supply * 0.1) : 0
                    return (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="px-1 py-1.5">
                          <Select value={d.itemId} onValueChange={(v) => updateDetail(idx, 'itemId', v)}>
                            <SelectTrigger className="h-7 min-w-[140px] text-xs">
                              <SelectValue placeholder="품목 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map((it: any) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.itemCode} - {it.itemName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="number"
                            className="h-7 w-[70px] text-right text-xs"
                            value={d.quantity || ''}
                            onChange={(e) => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            type="number"
                            className="h-7 w-[90px] text-right text-xs"
                            value={d.unitPrice || ''}
                            onChange={(e) => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{formatCurrency(supply)}</td>
                        <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">{formatCurrency(tax)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                          {formatCurrency(supply + tax)}
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            className="h-7 w-[120px] text-xs"
                            placeholder="비고"
                            value={d.description}
                            onChange={(e) => updateDetail(idx, 'description', e.target.value)}
                          />
                        </td>
                        <td className="px-1 py-1.5">
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
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t">
                    <td className="px-2 py-2 text-xs font-medium">합계</td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {details.reduce((s, d) => s + d.quantity, 0)}
                    </td>
                    <td></td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {formatCurrency(details.reduce((s, d) => s + d.quantity * d.unitPrice, 0))}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs">
                      {formatCurrency(
                        details.reduce((s, d) => {
                          const sup = d.quantity * d.unitPrice
                          const tt = items.find((it: any) => it.id === d.itemId)?.taxType || 'TAXABLE'
                          return s + (vatIncluded && tt === 'TAXABLE' ? Math.round(sup * 0.1) : 0)
                        }, 0)
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                      {formatCurrency(
                        details.reduce((s, d) => {
                          const sup = d.quantity * d.unitPrice
                          const tt = items.find((it: any) => it.id === d.itemId)?.taxType || 'TAXABLE'
                          const tx = vatIncluded && tt === 'TAXABLE' ? Math.round(sup * 0.1) : 0
                          return s + sup + tx
                        }, 0)
                      )}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? '등록 중...' : '발주 등록'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )

  // Tracking upload dialog (online only)
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
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
      <PageHeader title="발주관리" description="발주를 등록하고 관리합니다" />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ONLINE">온라인</TabsTrigger>
          <TabsTrigger value="OFFLINE">오프라인</TabsTrigger>
        </TabsList>

        {/* 공통 필터 영역 */}
        <div className="space-y-3">
          {/* 요약 통계 바 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">전체</p>
              <p className="text-sm font-bold sm:text-lg">{summaryStats.totalCount}건</p>
            </div>
            <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
              <p className="text-muted-foreground text-[10px] sm:text-xs">합계 금액</p>
              <p className="text-sm font-bold sm:text-lg">{formatCurrency(summaryStats.totalAmount)}</p>
            </div>
            <div className="rounded-lg border bg-blue-50 p-3 text-center sm:p-4 dark:bg-blue-950/30">
              <p className="text-muted-foreground text-[10px] sm:text-xs">발주</p>
              <p className="text-sm font-bold text-blue-600 sm:text-lg dark:text-blue-500">
                {summaryStats.orderedCount}건
              </p>
            </div>
            <div className="rounded-lg border bg-yellow-50 p-3 text-center sm:p-4 dark:bg-yellow-950/30">
              <p className="text-muted-foreground text-[10px] sm:text-xs">진행중</p>
              <p className="text-sm font-bold text-yellow-600 sm:text-lg dark:text-yellow-500">
                {summaryStats.inProgressCount}건
              </p>
            </div>
            <div className="col-span-2 rounded-lg border bg-green-50 p-3 text-center sm:col-span-1 sm:p-4 dark:bg-green-950/30">
              <p className="text-muted-foreground text-[10px] sm:text-xs">완료</p>
              <p className="text-sm font-bold text-green-600 sm:text-lg dark:text-green-500">
                {summaryStats.completedCount}건
              </p>
            </div>
          </div>

          {/* 필터 바 1행 */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="전체 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={datePreset}
              onValueChange={(v) => {
                setDatePreset(v)
                setDateFilter('preset')
              }}
            >
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="thisWeek">이번 주</SelectItem>
                <SelectItem value="thisMonth">이번 달</SelectItem>
                <SelectItem value="lastMonth">지난 달</SelectItem>
                <SelectItem value="last3Months">최근 3개월</SelectItem>
                <SelectItem value="thisYear">올해</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="발주번호 / 거래처 검색..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && queryClient.invalidateQueries({ queryKey: ['sales-orders'] })}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              aria-label="필터"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleResetFilters} aria-label="초기화">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* 고급 필터 (토글) */}
          {showAdvancedFilter && (
            <div className="bg-muted/20 flex flex-wrap items-end gap-2 rounded-lg border p-3">
              <div className="space-y-1">
                <Label className="text-xs">거래처</Label>
                <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="전체 거래처" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.partnerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">기간 유형</Label>
                <Select value={dateFilter} onValueChange={(v: 'monthly' | 'daily' | 'preset') => setDateFilter(v)}>
                  <SelectTrigger className="w-full sm:w-28">
                    <SelectValue />
                  </SelectTrigger>
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
                  <Input
                    type="month"
                    className="w-full sm:w-44"
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                  />
                </div>
              )}
              {dateFilter === 'daily' && (
                <div className="space-y-1">
                  <Label className="text-xs">일자</Label>
                  <Input
                    type="date"
                    className="w-full sm:w-44"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <TabsContent value="ONLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {onlineCreateDialog}
              <Button variant="outline" size="sm" onClick={handleOrderTemplateDownload}>
                <FileDown className="mr-1 h-3.5 w-3.5" /> 발주 템플릿
              </Button>
              <Button variant="outline" size="sm" onClick={() => orderImportFileRef.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> 엑셀 업로드
              </Button>
              <input
                ref={orderImportFileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleOrderImport}
              />
              {trackingDialog}
            </div>
            <DataTable
              columns={columns}
              data={onlineOrders}
              searchColumn="orderNo"
              searchPlaceholder="발주번호로 검색..."
              isLoading={onlineLoading}
              pageSize={50}
              selectable
              onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
              onBulkDelete={(rows) => {
                if (confirm(`선택한 ${rows.length}건을 삭제하시겠습니까?`)) {
                  Promise.all(rows.map((r: any) => api.delete(`/sales/orders/${r.id}`)))
                    .then(() => {
                      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
                      toast.success('삭제되었습니다.')
                    })
                    .catch(() => toast.error('일부 삭제 실패'))
                }
              }}
              bulkActions={[
                {
                  label: '일괄 다운로드',
                  icon: <Download className="mr-1.5 h-4 w-4" />,
                  action: (rows) => {
                    exportToExcel({
                      fileName: '선택_발주목록',
                      title: '발주관리 선택 목록',
                      columns: exportColumns,
                      data: rows,
                    })
                    toast.success('선택한 항목이 다운로드되었습니다.')
                  },
                },
                {
                  label: '일괄 취소',
                  icon: <XCircle className="mr-1.5 h-4 w-4" />,
                  variant: 'destructive',
                  action: (rows) => setBatchCancelConfirm(rows.map((r: any) => r.id)),
                },
                {
                  label: '일괄 완료',
                  icon: <CheckCircle className="mr-1.5 h-4 w-4" />,
                  action: (rows) => {
                    setBatchCompleteIds(rows.map((r: any) => r.id))
                    setBatchCompleteOpen(true)
                  },
                },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="OFFLINE">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">{offlineCreateDialog}</div>
            <DataTable
              columns={columns}
              data={offlineOrders}
              searchColumn="orderNo"
              searchPlaceholder="발주번호로 검색..."
              isLoading={offlineLoading}
              pageSize={50}
              selectable
              onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
              onBulkDelete={(rows) => {
                if (confirm(`선택한 ${rows.length}건을 삭제하시겠습니까?`)) {
                  Promise.all(rows.map((r: any) => api.delete(`/sales/orders/${r.id}`)))
                    .then(() => {
                      queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
                      toast.success('삭제되었습니다.')
                    })
                    .catch(() => toast.error('일부 삭제 실패'))
                }
              }}
              bulkActions={[
                {
                  label: '일괄 다운로드',
                  icon: <Download className="mr-1.5 h-4 w-4" />,
                  action: (rows) => {
                    exportToExcel({
                      fileName: '선택_발주목록',
                      title: '발주관리 선택 목록',
                      columns: exportColumns,
                      data: rows,
                    })
                    toast.success('선택한 항목이 다운로드되었습니다.')
                  },
                },
                {
                  label: '일괄 취소',
                  icon: <XCircle className="mr-1.5 h-4 w-4" />,
                  variant: 'destructive',
                  action: (rows) => setBatchCancelConfirm(rows.map((r: any) => r.id)),
                },
                {
                  label: '일괄 완료',
                  icon: <CheckCircle className="mr-1.5 h-4 w-4" />,
                  action: (rows) => {
                    setBatchCompleteIds(rows.map((r: any) => r.id))
                    setBatchCompleteOpen(true)
                  },
                },
              ]}
            />
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
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>발주 수정 - {editTarget?.orderNo}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <Tabs defaultValue="info">
              <TabsList variant="line">
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="files">
                  <Paperclip className="mr-1 h-3.5 w-3.5" />
                  특이사항
                </TabsTrigger>
                <TabsTrigger value="notes">
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  게시글
                </TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="pt-3">
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label>
                        발주일 <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        name="orderDate"
                        type="date"
                        required
                        aria-required="true"
                        defaultValue={editTarget.orderDate?.split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        거래처 <span className="text-destructive">*</span>
                      </Label>
                      <Select name="partnerId" defaultValue={editTarget.partnerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {partners.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.partnerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>납기일</Label>
                      <Input
                        name="deliveryDate"
                        type="date"
                        defaultValue={editTarget.deliveryDate?.split('T')[0] || ''}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>배차정보</Label>
                      <Input
                        name="dispatchInfo"
                        defaultValue={editTarget.dispatchInfo || ''}
                        placeholder="차량번호, 운송업체 등"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>발주 담당자</Label>
                      <Input name="receivedBy" defaultValue={editTarget.receivedBy || ''} placeholder="담당자 이름" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>비고</Label>
                    <Input name="description" defaultValue={editTarget.description || ''} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>품목</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditDetails([
                            ...editDetails,
                            { itemId: '', quantity: 1, unitPrice: 0, carrier: '', trackingNo: '', description: '' },
                          ])
                        }
                      >
                        <Plus className="mr-1 h-3 w-3" /> 행 추가
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {editDetails.map((d, idx) => {
                        const supply = d.quantity * d.unitPrice
                        const editItemTaxType = items.find((it: any) => it.id === d.itemId)?.taxType || 'TAXABLE'
                        const editVat = editTarget?.vatIncluded !== false
                        const editTax = editVat && editItemTaxType === 'TAXABLE' ? Math.round(supply * 0.1) : 0
                        return (
                          <div key={idx} className="space-y-2 rounded-md border p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground text-xs font-medium">품목 #{idx + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  editDetails.length > 1 && setEditDetails(editDetails.filter((_, i) => i !== idx))
                                }
                                disabled={editDetails.length <= 1}
                                aria-label="삭제"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                            <Select
                              value={d.itemId}
                              onValueChange={(v) => {
                                const nd = [...editDetails]
                                nd[idx].itemId = v
                                setEditDetails(nd)
                              }}
                            >
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
                              <div className="space-y-1">
                                <Label className="text-[11px]">수량</Label>
                                <Input
                                  type="number"
                                  className="text-xs"
                                  value={d.quantity || ''}
                                  onChange={(e) => {
                                    const nd = [...editDetails]
                                    nd[idx].quantity = parseFloat(e.target.value) || 0
                                    setEditDetails(nd)
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">단가</Label>
                                <Input
                                  type="number"
                                  className="text-xs"
                                  value={d.unitPrice || ''}
                                  onChange={(e) => {
                                    const nd = [...editDetails]
                                    nd[idx].unitPrice = parseFloat(e.target.value) || 0
                                    setEditDetails(nd)
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">합계(부가세 포함)</Label>
                                <div className="bg-muted/50 flex h-9 items-center justify-end rounded-md border px-2 font-mono text-xs font-medium">
                                  {formatCurrency(supply + editTax)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={editMutation.isPending}>
                    {editMutation.isPending ? '수정 중...' : '발주 수정'}
                  </Button>
                </form>
              </TabsContent>
              <RecordSubTabs relatedTable="SalesOrder" relatedId={editTarget.id} />
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* 완료 처리 Dialog (배차정보/담당자 입력) */}
      <Dialog open={!!completeTarget} onOpenChange={(v) => !v && setCompleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>발주 완료 처리 - {completeTarget?.orderNo}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              const dispatchInfo = form.get('dispatchInfo') as string
              const receivedBy = form.get('receivedBy') as string
              if (!dispatchInfo || !receivedBy) {
                toast.error('배차정보와 담당자를 입력해주세요.')
                return
              }
              completeMutation.mutate({ id: completeTarget.id, dispatchInfo, receivedBy })
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>
                배차정보 <span className="text-destructive">*</span>
              </Label>
              <Input
                name="dispatchInfo"
                required
                aria-required="true"
                placeholder="차량번호, 운송업체 등"
                defaultValue={completeTarget?.dispatchInfo || ''}
              />
            </div>
            <div className="space-y-2">
              <Label>
                발주 담당자 <span className="text-destructive">*</span>
              </Label>
              <Input
                name="receivedBy"
                required
                placeholder="담당자 이름"
                defaultValue={completeTarget?.receivedBy || ''}
              />
            </div>
            <Button type="submit" className="w-full" disabled={completeMutation.isPending}>
              {completeMutation.isPending ? '처리 중...' : '완료 처리'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 일괄 완료 처리 Dialog */}
      <Dialog
        open={batchCompleteOpen}
        onOpenChange={(v) => {
          if (!v) {
            setBatchCompleteOpen(false)
            setBatchCompleteIds([])
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>일괄 완료 처리 ({batchCompleteIds.length}건)</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              const dispatchInfo = form.get('dispatchInfo') as string
              const receivedBy = form.get('receivedBy') as string
              if (!dispatchInfo || !receivedBy) {
                toast.error('배차정보와 담당자를 입력해주세요.')
                return
              }
              batchMutation.mutate({ ids: batchCompleteIds, action: 'complete', dispatchInfo, receivedBy })
            }}
            className="space-y-4"
          >
            <p className="text-muted-foreground text-sm">
              선택한 {batchCompleteIds.length}건의 발주를 일괄 완료 처리합니다.
            </p>
            <div className="space-y-2">
              <Label>
                배차정보 <span className="text-destructive">*</span>
              </Label>
              <Input name="dispatchInfo" required aria-required="true" placeholder="차량번호, 운송업체 등" />
            </div>
            <div className="space-y-2">
              <Label>
                발주 담당자 <span className="text-destructive">*</span>
              </Label>
              <Input name="receivedBy" required aria-required="true" placeholder="담당자 이름" />
            </div>
            <Button type="submit" className="w-full" disabled={batchMutation.isPending}>
              {batchMutation.isPending ? '처리 중...' : `${batchCompleteIds.length}건 완료 처리`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="발주 취소"
        description={`[${cancelTarget?.orderNo}]을(를) 취소하시겠습니까?`}
        confirmLabel="취소 처리"
        variant="destructive"
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        isPending={cancelMutation.isPending}
      />

      <ConfirmDialog
        open={!!batchCancelConfirm}
        onOpenChange={(open) => !open && setBatchCancelConfirm(null)}
        title="일괄 취소"
        description={`선택한 ${batchCancelConfirm?.length || 0}건을 취소하시겠습니까?`}
        confirmLabel="일괄 취소"
        variant="destructive"
        onConfirm={() => batchCancelConfirm && batchMutation.mutate({ ids: batchCancelConfirm, action: 'cancel' })}
        isPending={batchMutation.isPending}
      />
    </div>
  )
}
