'use client'

import { useState, useRef, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatCurrency, getLocalDateString } from '@/lib/format'
import { exportToExcel, exportToPDF, downloadImportTemplate, readExcelFile, type ExportColumn } from '@/lib/export'
import { generateTransactionStatementPDF, type TransactionStatementPDFData } from '@/lib/pdf-reports'
import { COMPANY_NAME } from '@/lib/constants'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, FileDown, ClipboardCheck, Eye, CalendarDays, Table2 } from 'lucide-react'
import { CalendarView, type CalendarEvent } from '@/components/common/calendar-view'

const STATUS_MAP: Record<string, string> = { PREPARING: '준비중', SHIPPED: '출하', DELIVERED: '납품완료' }
const QUALITY_STATUS_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PASS: { label: '합격', variant: 'default' },
  CONDITIONAL_PASS: { label: '조건부합격', variant: 'secondary' },
  FAIL: { label: '불합격', variant: 'destructive' },
}
const GRADE_MAP: Record<string, { label: string; color: string }> = {
  A: { label: 'A등급', color: 'text-status-success' },
  B: { label: 'B등급', color: 'text-status-info' },
  C: { label: 'C등급', color: 'text-status-warning' },
  REJECT: { label: '불합격', color: 'text-status-danger' },
}

// 삼성/하이닉스 납품 기준 검사 카테고리
const INSPECTION_CATEGORIES = [
  { value: 'APPEARANCE', label: '외관검사' },
  { value: 'DIMENSION', label: '치수검사' },
  { value: 'FUNCTION', label: '기능검사' },
  { value: 'RELIABILITY', label: '신뢰성검사' },
  { value: 'PACKAGING', label: '포장상태' },
  { value: 'DOCUMENT', label: '서류검사' },
  { value: 'LABEL', label: '라벨/마킹' },
  { value: 'CLEANLINESS', label: '청정도' },
]

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  INSPECTION_CATEGORIES.map((c) => [c.value, c.label])
)

// 기본 검사 항목 템플릿 (반도체 납품 기준)
const DEFAULT_INSPECTION_ITEMS = [
  {
    category: 'APPEARANCE',
    checkItem: '외관 손상 여부 (스크래치, 찍힘, 변색)',
    spec: '무결점',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'APPEARANCE',
    checkItem: '이물질 부착 여부',
    spec: '이물질 없음',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'DIMENSION',
    checkItem: '주요 치수 규격 적합성',
    spec: '도면 기준 ±공차 이내',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'FUNCTION',
    checkItem: '기능/성능 테스트 결과',
    spec: '사양서 기준 충족',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'RELIABILITY',
    checkItem: '내구성/수명 테스트',
    spec: '기준 수명 이상',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'PACKAGING',
    checkItem: '포장 상태 및 완충재',
    spec: '규정 포장 준수',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'PACKAGING',
    checkItem: '방습/정전기 방지 포장',
    spec: 'ESD 포장 적용',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'DOCUMENT',
    checkItem: '품질성적서 첨부 여부',
    spec: '필수 첨부',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'DOCUMENT',
    checkItem: '출하검사 성적서',
    spec: '필수 첨부',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'LABEL',
    checkItem: 'LOT번호/바코드 표기',
    spec: '규정 라벨 부착',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
  {
    category: 'CLEANLINESS',
    checkItem: '파티클/오염도 검사',
    spec: 'Class 기준 이내',
    result: 'PASS' as const,
    grade: 'A' as const,
  },
]

interface InspectionItemInput {
  category: string
  checkItem: string
  spec: string
  measuredValue: string
  result: 'PASS' | 'FAIL' | 'NA'
  grade: 'A' | 'B' | 'C' | 'REJECT'
  defectType: string
  remarks: string
}

interface Detail {
  itemId: string
  quantity: number
  unitPrice: number
  carrier: string
  trackingNo: string
  description: string
}

interface TrackingRow {
  deliveryNo: string
  carrier: string
  trackingNo: string
}

const emptyDetail = (): Detail => ({
  itemId: '',
  quantity: 1,
  unitPrice: 0,
  carrier: '',
  trackingNo: '',
  description: '',
})

const emptyInspectionItem = (): InspectionItemInput => ({
  category: 'APPEARANCE',
  checkItem: '',
  spec: '',
  measuredValue: '',
  result: 'PASS',
  grade: 'A',
  defectType: '',
  remarks: '',
})

export default function DeliveriesPage() {
  const [activeTab, setActiveTab] = useState<string>('ONLINE')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<{ date: string; events: CalendarEvent[] } | null>(
    null
  )

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
      id: 'qualityStatus',
      header: '품질검사',
      cell: ({ row }) => {
        const inspection = row.original.qualityInspections?.[0]
        if (!inspection) {
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => openQualityInspection(row.original)}
            >
              <ClipboardCheck className="mr-1 h-3 w-3" />
              검사등록
            </Button>
          )
        }
        const qs = QUALITY_STATUS_MAP[inspection.judgement] || {
          label: inspection.judgement,
          variant: 'outline' as const,
        }
        const grade = GRADE_MAP[inspection.overallGrade]
        return (
          <div className="flex items-center gap-1">
            <Badge variant={qs.variant} className="text-xs">
              {qs.label}
            </Badge>
            {grade && <span className={`text-xs font-medium ${grade.color}`}>{grade.label}</span>}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => openQualityView(row.original)}
              title="검사 상세"
            >
              <Eye className="h-3 w-3" />
            </Button>
          </div>
        )
      },
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
    {
      header: '품질검사',
      accessor: (r) => {
        const qi = r.qualityInspections?.[0]
        return qi
          ? `${QUALITY_STATUS_MAP[qi.judgement]?.label || qi.judgement} (${GRADE_MAP[qi.overallGrade]?.label || qi.overallGrade})`
          : '미검사'
      },
    },
    { header: '운송장번호', accessor: (r) => r.trackingNo || '' },
    { header: '택배사', accessor: (r) => r.carrier || '' },
  ]

  const [open, setOpen] = useState(false)
  const [trackingOpen, setTrackingOpen] = useState(false)
  const [details, setDetails] = useState<Detail[]>([emptyDetail()])
  const [trackingRows, setTrackingRows] = useState<TrackingRow[]>([])
  const [trackingResult, setTrackingResult] = useState<{
    total: number
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const deliveryImportFileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // 품질검사 state
  const [qiOpen, setQiOpen] = useState(false)
  const [qiViewOpen, setQiViewOpen] = useState(false)
  const [qiDelivery, setQiDelivery] = useState<any>(null)
  const [qiItems, setQiItems] = useState<InspectionItemInput[]>([])
  const [qiViewData, setQiViewData] = useState<any>(null)

  const openQualityInspection = (delivery: any) => {
    setQiDelivery(delivery)
    setQiItems(
      DEFAULT_INSPECTION_ITEMS.map((item) => ({
        ...item,
        measuredValue: '',
        defectType: '',
        remarks: '',
      }))
    )
    setQiOpen(true)
  }

  const openQualityView = async (delivery: any) => {
    try {
      const res = (await api.get(`/sales/deliveries/${delivery.id}/quality-inspection`)) as any
      setQiViewData(res.data || res)
      setQiDelivery(delivery)
      setQiViewOpen(true)
    } catch {
      toast.error('품질검사 정보를 불러올 수 없습니다.')
    }
  }

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
    mutationFn: (body: any) => api.post('/sales/deliveries', body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setOpen(false)
      setDetails([emptyDetail()])
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

  const qiMutation = useMutation({
    mutationFn: (body: any) => api.post(`/sales/deliveries/${body.deliveryId}/quality-inspection`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setQiOpen(false)
      setQiDelivery(null)
      setQiItems([])
      toast.success('품질검사가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const orders = ordersData?.data || []
  const partners = partnersData?.data || []
  const items = itemsData?.data || []
  const onlineDeliveries = onlineData?.data || []
  const offlineDeliveries = offlineData?.data || []

  // Calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const deliveries = activeTab === 'ONLINE' ? onlineDeliveries : offlineDeliveries
    const statusVariant: Record<string, CalendarEvent['variant']> = {
      PREPARING: 'warning',
      SHIPPED: 'info',
      DELIVERED: 'success',
    }
    return deliveries.map((d: any) => ({
      id: d.id,
      date: d.deliveryDate?.split('T')[0] || '',
      label: `${d.deliveryNo} ${d.partner?.partnerName || ''}`.trim(),
      sublabel: `${STATUS_MAP[d.status] || d.status} · ${d.details?.length || 0}건`,
      variant: statusVariant[d.status] || 'default',
    }))
  }, [activeTab, onlineDeliveries, offlineDeliveries])

  const updateDetail = (idx: number, field: string, value: any) => {
    const d = [...details]
    ;(d[idx] as any)[field] = value
    setDetails(d)
  }

  const updateQiItem = (idx: number, field: string, value: any) => {
    const items = [...qiItems]
    ;(items[idx] as any)[field] = value
    // FAIL이면 grade를 REJECT로 자동 변경
    if (field === 'result' && value === 'FAIL') {
      items[idx].grade = 'REJECT'
    }
    setQiItems(items)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      deliveryDate: form.get('deliveryDate'),
      salesOrderId: form.get('salesOrderId'),
      deliveryAddress: form.get('deliveryAddress') || undefined,
      carrier: details[0]?.carrier || undefined,
      trackingNo: details[0]?.trackingNo || undefined,
      details: details
        .filter((d) => d.itemId)
        .map(({ itemId, quantity, unitPrice }) => ({ itemId, quantity, unitPrice })),
    })
  }

  const handleQiSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!qiDelivery) return
    const form = new FormData(e.currentTarget)
    const failCount = qiItems.filter((i) => i.result === 'FAIL').length
    const sampleSize = parseInt(form.get('sampleSize') as string) || 0
    const defectCount = parseInt(form.get('defectCount') as string) || 0

    // 전체 등급 자동 산정
    const grades = qiItems.map((i) => i.grade)
    let overallGrade: 'A' | 'B' | 'C' | 'REJECT' = 'A'
    if (grades.includes('REJECT') || failCount > 0) overallGrade = 'REJECT'
    else if (grades.includes('C')) overallGrade = 'C'
    else if (grades.includes('B')) overallGrade = 'B'

    // 판정: FAIL 항목이 있으면 FAIL, C등급이면 CONDITIONAL_PASS
    let judgement: 'PASS' | 'CONDITIONAL_PASS' | 'FAIL' = 'PASS'
    if (overallGrade === 'REJECT') judgement = 'FAIL'
    else if (overallGrade === 'C') judgement = 'CONDITIONAL_PASS'

    qiMutation.mutate({
      deliveryId: qiDelivery.id,
      inspectionDate: form.get('inspectionDate'),
      inspectorName: form.get('inspectorName'),
      overallGrade,
      sampleSize,
      defectCount,
      lotNo: form.get('lotNo') || undefined,
      judgement,
      remarks: form.get('remarks') || undefined,
      items: qiItems
        .filter((i) => i.checkItem)
        .map((i) => ({
          category: i.category,
          checkItem: i.checkItem,
          spec: i.spec || undefined,
          measuredValue: i.measuredValue || undefined,
          result: i.result,
          grade: i.grade,
          defectType: i.defectType || undefined,
          remarks: i.remarks || undefined,
        })),
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

  const handleDeliveryTemplateDownload = () => {
    // 회사 정보 가져오기
    const companies = companyData?.data || []
    const company = companies.find((c: any) => c.isDefault) || companies[0]
    const senderName = company?.companyName || ''
    const senderPhone = company?.phone || ''
    const senderAddress = company?.address || ''

    downloadImportTemplate({
      fileName: '납품_등록_템플릿',
      sheetName: '납품',
      columns: [
        { header: '도서', key: 'isIsland', example: '', width: 6 },
        { header: '운송장번호', key: 'trackingNo', example: '', width: 16 },
        { header: '보내시는 분', key: 'senderName', example: senderName, width: 16 },
        { header: '보내시는 분 전화', key: 'senderPhone', example: senderPhone, width: 16 },
        { header: '보내는분담당자', key: 'senderContact', example: '', width: 14 },
        { header: '보내는분담당자HP', key: 'senderContactHP', example: '', width: 16 },
        { header: '보내는분우편번호', key: 'senderZip', example: '', width: 14 },
        { header: '보내는분총주소', key: 'senderAddress', example: senderAddress, width: 28 },
        { header: '받으시는 분', key: 'receiverName', example: '(주)거래처명', width: 16, required: true },
        { header: '받으시는 분 전화', key: 'receiverPhone', example: '02-1234-5678', width: 16 },
        { header: '받는분담당자', key: 'receiverContact', example: '담당자명', width: 14 },
        { header: '받는분핸드폰', key: 'receiverMobile', example: '010-1234-5678', width: 16 },
        { header: '받는분우편번호', key: 'receiverZip', example: '06000', width: 14 },
        { header: '받는분총주소', key: 'receiverAddress', example: '서울시 강남구', width: 28, required: true },
        { header: '송고번호', key: 'shipmentRef', example: '', width: 14 },
        { header: '특기사항', key: 'specialNote', example: '', width: 20 },
        { header: '메모1', key: 'memo', example: '', width: 16 },
        { header: '내품명', key: 'itemName', example: '품목명', width: 18, required: true },
        { header: '내품수량', key: 'quantity', example: '10', width: 10, required: true },
        { header: '내품가격', key: 'unitPrice', example: '50000', width: 12 },
        { header: '상품코드', key: 'itemCode', example: '', width: 14 },
        { header: '주문번호', key: 'orderNo', example: 'ORD-20260201-001', width: 22 },
        { header: '배송성명', key: 'deliveryName', example: '', width: 14 },
      ],
    })
  }

  const handleDeliveryImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const keyMap: Record<string, string> = {
        도서: 'isIsland',
        운송장번호: 'trackingNo',
        '보내시는 분': 'senderName',
        '보내시는 분 전화': 'senderPhone',
        보내는분담당자: 'senderContact',
        보내는분담당자HP: 'senderContactHP',
        보내는분우편번호: 'senderZip',
        보내는분총주소: 'senderAddress',
        '받으시는 분': 'receiverName',
        '받으시는 분 전화': 'receiverPhone',
        받는분담당자: 'receiverContact',
        받는분핸드폰: 'receiverMobile',
        받는분우편번호: 'receiverZip',
        받는분총주소: 'receiverAddress',
        송고번호: 'shipmentRef',
        특기사항: 'specialNote',
        메모1: 'memo',
        내품명: 'itemName',
        내품수량: 'quantity',
        내품가격: 'unitPrice',
        상품코드: 'itemCode',
        주문번호: 'orderNo',
        배송성명: 'deliveryName',
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
      const today = getLocalDateString()
      for (const row of rows) {
        const orderNoVal = normalize(row.orderNo)
        const order = orders.find((o: any) => normalize(o.orderNo) === orderNoVal)
        const nameVal = normalize(row.itemName)
        const codeVal = normalize(row.itemCode)
        // 품목 매칭: 품목명(정확) → 품목코드(정확) → 부분 포함
        const item =
          items.find(
            (it: any) =>
              (nameVal && normalize(it.itemName) === nameVal) ||
              (nameVal && normalize(it.itemCode) === nameVal) ||
              (codeVal && normalize(it.itemCode) === codeVal)
          ) ||
          items.find(
            (it: any) =>
              (nameVal && normalize(it.itemName).includes(nameVal)) ||
              (codeVal && normalize(it.itemName).includes(codeVal))
          )
        if (!item) {
          failCount++
          failReasons.push(`내품명 "${row.itemName || row.itemCode}" 미매칭`)
          continue
        }
        if (!order?.id) {
          failCount++
          failReasons.push(`주문번호 "${row.orderNo || ''}" 미매칭`)
          continue
        }
        try {
          await api.post('/sales/deliveries', {
            deliveryDate: today,
            salesOrderId: order.id,
            deliveryAddress: row.receiverAddress || undefined,
            trackingNo: row.trackingNo || undefined,
            details: [{ itemId: item.id, quantity: Number(row.quantity) || 1, unitPrice: Number(row.unitPrice) || 0 }],
          })
          successCount++
        } catch (err: any) {
          failCount++
          failReasons.push(err?.message || `납품 생성 실패`)
        }
      }
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      if (failReasons.length > 0) {
        toast.error(
          `${successCount}건 등록, ${failCount}건 실패: ${failReasons.slice(0, 3).join(', ')}${failReasons.length > 3 ? ' ...' : ''}`
        )
      } else {
        toast.success(`${successCount}건 등록 완료${failCount > 0 ? `, ${failCount}건 실패` : ''}`)
      }
    } catch (err: any) {
      toast.error(err.message || '엑셀 파일을 읽을 수 없습니다.')
    }
    if (deliveryImportFileRef.current) deliveryImportFileRef.current.value = ''
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file, { 납품번호: 'deliveryNo', 택배사: 'carrier', 운송장번호: 'trackingNo' })
      setTrackingRows(rows as TrackingRow[])
      setTrackingResult(null)
    } catch {
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

  // 회사 정보 (보내는분 자동 채움)
  const companyInfo = (() => {
    const companies = companyData?.data || []
    return companies.find((c: any) => c.isDefault) || companies[0] || {}
  })()

  // ── 온라인: 택배 양식 (보내는분/받는분 + 내품 테이블) ──
  const onlineCreateDialog = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setDetails([emptyDetail()])
      }}
    >
      <DialogTrigger asChild>
        <Button>납품 등록</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-3xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>납품 등록 (온라인)</DialogTitle>
          <p className="text-muted-foreground text-xs">
            <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
          </p>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">
                납품일 <span className="text-destructive">*</span>
              </Label>
              <Input name="deliveryDate" type="date" required className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                발주 <span className="text-destructive">*</span>
              </Label>
              <Select name="salesOrderId">
                <SelectTrigger className="h-8 text-xs">
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
            <div className="space-y-1">
              <Label className="text-xs">납품주소</Label>
              <Input name="deliveryAddress" className="h-8 text-xs" placeholder="납품주소" />
            </div>
          </div>

          {/* 보내는분 / 받는분 정보 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-status-info text-xs font-medium">보내는분 (발신)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  className="h-7 text-xs"
                  placeholder="보내시는 분"
                  defaultValue={companyInfo.companyName || ''}
                  name="senderName"
                />
                <Input
                  className="h-7 text-xs"
                  placeholder="전화"
                  defaultValue={companyInfo.phone || ''}
                  name="senderPhone"
                />
                <Input
                  className="col-span-2 h-7 text-xs"
                  placeholder="주소"
                  defaultValue={companyInfo.address || ''}
                  name="senderAddress"
                />
              </div>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <Label className="text-status-success text-xs font-medium">받는분 (수신)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input className="h-7 text-xs" placeholder="받으시는 분" name="receiverName" />
                <Input className="h-7 text-xs" placeholder="전화/핸드폰" name="receiverPhone" />
                <Input className="h-7 text-xs" placeholder="우편번호" name="receiverZip" />
                <Input className="h-7 text-xs" placeholder="주소" name="receiverAddress" />
              </div>
            </div>
          </div>

          {/* 품목 테이블 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">내품 상세</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDetails([...details, emptyDetail()])}
              >
                <Plus className="mr-1 h-3 w-3" /> 행 추가
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[700px] text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">
                      내품명 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">내품수량</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">내품가격</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">금액</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">운송장번호</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">특기사항</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, idx) => {
                    const amount = d.quantity * d.unitPrice
                    return (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="px-2 py-1.5">
                          <Select value={d.itemId} onValueChange={(v) => updateDetail(idx, 'itemId', v)}>
                            <SelectTrigger className="h-7 w-full text-xs">
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
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            className="h-7 w-full text-right text-xs"
                            value={d.quantity || ''}
                            onChange={(e) => updateDetail(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            className="h-7 w-full text-right text-xs"
                            value={d.unitPrice || ''}
                            onChange={(e) => updateDetail(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                          {formatCurrency(amount)}
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-7 w-full text-xs"
                            placeholder="운송장번호"
                            value={d.trackingNo}
                            onChange={(e) => updateDetail(idx, 'trackingNo', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-7 w-full text-xs"
                            placeholder="특기사항"
                            value={d.description}
                            onChange={(e) => updateDetail(idx, 'description', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-center">
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
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                      {formatCurrency(details.reduce((s, d) => s + d.quantity * d.unitPrice, 0))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? '등록 중...' : '납품 등록'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )

  // ── 오프라인: 기존 양식 (납품일/발주선택/납품주소 + 품목/수량/단가/금액 테이블) ──
  const offlineCreateDialog = (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setDetails([emptyDetail()])
      }}
    >
      <DialogTrigger asChild>
        <Button>납품 등록</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>납품 등록 (오프라인)</DialogTitle>
          <p className="text-muted-foreground text-xs">
            <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
          </p>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">
                납품일 <span className="text-destructive">*</span>
              </Label>
              <Input name="deliveryDate" type="date" required className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                발주 <span className="text-destructive">*</span>
              </Label>
              <Select name="salesOrderId">
                <SelectTrigger className="h-8 text-xs">
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
            <div className="space-y-1">
              <Label className="text-xs">납품주소</Label>
              <Input name="deliveryAddress" className="h-8 text-xs" placeholder="납품주소" />
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
                onClick={() => setDetails([...details, emptyDetail()])}
              >
                <Plus className="mr-1 h-3 w-3" /> 행 추가
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">
                      품목명 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">수량</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">단가</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">금액</th>
                    <th className="w-8 px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, idx) => {
                    const amount = d.quantity * d.unitPrice
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
                        <td className="px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                          {formatCurrency(amount)}
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
                    <td className="px-2 py-2 text-right font-mono text-xs font-medium">
                      {formatCurrency(details.reduce((s, d) => s + d.quantity * d.unitPrice, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

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
                <span className="text-status-success">
                  성공: <strong>{trackingResult.success}건</strong>
                </span>
                <span className="text-status-danger">
                  실패: <strong>{trackingResult.failed}건</strong>
                </span>
              </div>
              {trackingResult.errors.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-status-danger">오류 목록</Label>
                  <div className="text-status-danger max-h-32 space-y-1 overflow-y-auto text-xs">
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

  // 품질검사 등록 다이얼로그
  const qualityInspectionDialog = (
    <Dialog
      open={qiOpen}
      onOpenChange={(v) => {
        setQiOpen(v)
        if (!v) {
          setQiDelivery(null)
          setQiItems([])
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-4xl lg:max-w-6xl">
        <DialogHeader>
          <DialogTitle>
            납품 품질검사 - {qiDelivery?.deliveryNo}
            <span className="text-muted-foreground ml-2 text-sm font-normal">({qiDelivery?.partner?.partnerName})</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleQiSubmit} className="space-y-4">
          {/* 검사 기본 정보 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">
                검사일 <span className="text-destructive">*</span>
              </Label>
              <Input
                name="inspectionDate"
                type="date"
                required
                className="h-8 text-xs"
                defaultValue={getLocalDateString()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                검사자 <span className="text-destructive">*</span>
              </Label>
              <Input name="inspectorName" required className="h-8 text-xs" placeholder="검사자명" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">LOT 번호</Label>
              <Input name="lotNo" className="h-8 text-xs" placeholder="LOT-YYYYMMDD-001" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">시료수</Label>
                <Input name="sampleSize" type="number" className="h-8 text-xs" defaultValue="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">불량수</Label>
                <Input name="defectCount" type="number" className="h-8 text-xs" defaultValue="0" />
              </div>
            </div>
          </div>

          {/* 검사 항목 테이블 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">검사 항목 (삼성/하이닉스 납품 기준)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setQiItems([...qiItems, emptyInspectionItem()])}
              >
                <Plus className="mr-1 h-3 w-3" /> 항목 추가
              </Button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">구분</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">
                      검사항목 <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">규격/기준</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">측정값</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap">판정</th>
                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap">등급</th>
                    <th className="px-2 py-2 text-left font-medium whitespace-nowrap">불량유형</th>
                    <th className="w-8 px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {qiItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className={`border-b last:border-b-0 ${item.result === 'FAIL' ? 'bg-status-danger-muted' : ''}`}
                    >
                      <td className="px-1 py-1.5">
                        <Select value={item.category} onValueChange={(v) => updateQiItem(idx, 'category', v)}>
                          <SelectTrigger className="h-7 min-w-[90px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INSPECTION_CATEGORIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          className="h-7 min-w-[180px] text-xs"
                          value={item.checkItem}
                          onChange={(e) => updateQiItem(idx, 'checkItem', e.target.value)}
                          placeholder="검사항목 입력"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          className="h-7 w-[120px] text-xs"
                          value={item.spec}
                          onChange={(e) => updateQiItem(idx, 'spec', e.target.value)}
                          placeholder="규격/기준"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          className="h-7 w-[100px] text-xs"
                          value={item.measuredValue}
                          onChange={(e) => updateQiItem(idx, 'measuredValue', e.target.value)}
                          placeholder="측정값"
                        />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <Select value={item.result} onValueChange={(v) => updateQiItem(idx, 'result', v)}>
                          <SelectTrigger
                            className={`h-7 w-[72px] text-xs ${item.result === 'FAIL' ? 'border-destructive text-status-danger' : item.result === 'PASS' ? 'text-status-success' : ''}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PASS">PASS</SelectItem>
                            <SelectItem value="FAIL">FAIL</SelectItem>
                            <SelectItem value="NA">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <Select value={item.grade} onValueChange={(v) => updateQiItem(idx, 'grade', v)}>
                          <SelectTrigger className={`h-7 w-[72px] text-xs ${GRADE_MAP[item.grade]?.color || ''}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">A</SelectItem>
                            <SelectItem value="B">B</SelectItem>
                            <SelectItem value="C">C</SelectItem>
                            <SelectItem value="REJECT">REJECT</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          className="h-7 w-[100px] text-xs"
                          value={item.defectType}
                          onChange={(e) => updateQiItem(idx, 'defectType', e.target.value)}
                          placeholder="불량유형"
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => qiItems.length > 1 && setQiItems(qiItems.filter((_, i) => i !== idx))}
                          disabled={qiItems.length <= 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 border-t">
                    <td colSpan={4} className="px-2 py-2 text-xs font-medium">
                      검사 요약: {qiItems.length}개 항목 | PASS {qiItems.filter((i) => i.result === 'PASS').length} |
                      FAIL{' '}
                      <span className="text-status-danger">{qiItems.filter((i) => i.result === 'FAIL').length}</span> |
                      N/A {qiItems.filter((i) => i.result === 'NA').length}
                    </td>
                    <td colSpan={4} className="px-2 py-2 text-right text-xs">
                      {(() => {
                        const failCount = qiItems.filter((i) => i.result === 'FAIL').length
                        const grades = qiItems.map((i) => i.grade)
                        if (failCount > 0 || grades.includes('REJECT'))
                          return <Badge variant="destructive">불합격 예상</Badge>
                        if (grades.includes('C')) return <Badge variant="secondary">조건부합격 예상</Badge>
                        return <Badge variant="default">합격 예상</Badge>
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 비고 */}
          <div className="space-y-1">
            <Label className="text-xs">비고/특이사항</Label>
            <Textarea name="remarks" className="text-xs" rows={2} placeholder="검사 관련 특이사항을 기록합니다" />
          </div>

          <Button type="submit" className="w-full" disabled={qiMutation.isPending}>
            {qiMutation.isPending ? '등록 중...' : '품질검사 완료'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )

  // 품질검사 조회 다이얼로그
  const qualityViewDialog = (
    <Dialog open={qiViewOpen} onOpenChange={setQiViewOpen}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>품질검사 결과 - {qiDelivery?.deliveryNo}</DialogTitle>
        </DialogHeader>
        {Array.isArray(qiViewData) && qiViewData.length > 0 ? (
          <div className="space-y-4">
            {qiViewData.map((inspection: any) => (
              <div key={inspection.id} className="space-y-3 rounded-md border p-4">
                {/* 검사 헤더 */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm font-medium">{inspection.inspectionNo}</span>
                  <Badge variant={QUALITY_STATUS_MAP[inspection.judgement]?.variant || 'outline'}>
                    {QUALITY_STATUS_MAP[inspection.judgement]?.label || inspection.judgement}
                  </Badge>
                  <span className={`text-sm font-medium ${GRADE_MAP[inspection.overallGrade]?.color || ''}`}>
                    {GRADE_MAP[inspection.overallGrade]?.label || inspection.overallGrade}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    검사일: {formatDate(inspection.inspectionDate)} | 검사자: {inspection.inspectorName}
                  </span>
                </div>

                {/* 검사 요약 */}
                <div className="bg-muted/30 grid grid-cols-2 gap-2 rounded-md p-3 sm:grid-cols-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">시료수</Label>
                    <p className="text-sm font-medium">{inspection.sampleSize}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">불량수</Label>
                    <p className="text-sm font-medium">{inspection.defectCount}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">불량률(PPM)</Label>
                    <p className="text-sm font-medium">
                      {Number(inspection.defectRate).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">LOT번호</Label>
                    <p className="font-mono text-sm font-medium">{inspection.lotNo || '-'}</p>
                  </div>
                </div>

                {/* 검사 항목 테이블 */}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-2 py-1.5 text-left font-medium">구분</th>
                        <th className="px-2 py-1.5 text-left font-medium">검사항목</th>
                        <th className="px-2 py-1.5 text-left font-medium">규격</th>
                        <th className="px-2 py-1.5 text-left font-medium">측정값</th>
                        <th className="px-2 py-1.5 text-center font-medium">판정</th>
                        <th className="px-2 py-1.5 text-center font-medium">등급</th>
                        <th className="px-2 py-1.5 text-left font-medium">불량유형</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inspection.items || []).map((item: any) => (
                        <tr
                          key={item.id}
                          className={`border-b last:border-b-0 ${item.result === 'FAIL' ? 'bg-status-danger-muted' : ''}`}
                        >
                          <td className="px-2 py-1.5">{CATEGORY_LABEL_MAP[item.category] || item.category}</td>
                          <td className="px-2 py-1.5">{item.checkItem}</td>
                          <td className="px-2 py-1.5">{item.spec || '-'}</td>
                          <td className="px-2 py-1.5">{item.measuredValue || '-'}</td>
                          <td className="px-2 py-1.5 text-center">
                            <Badge
                              variant={
                                item.result === 'PASS' ? 'default' : item.result === 'FAIL' ? 'destructive' : 'outline'
                              }
                              className="text-xs"
                            >
                              {item.result}
                            </Badge>
                          </td>
                          <td className={`px-2 py-1.5 text-center font-medium ${GRADE_MAP[item.grade]?.color || ''}`}>
                            {GRADE_MAP[item.grade]?.label || item.grade}
                          </td>
                          <td className="text-status-danger px-2 py-1.5">{item.defectType || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {inspection.remarks && (
                  <div className="bg-muted/30 rounded-md p-2 text-xs">
                    <Label className="text-muted-foreground text-xs">비고:</Label> {inspection.remarks}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">품질검사 기록이 없습니다.</p>
        )}
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="납품관리" description="고객 납품 현황 및 품질검사를 관리합니다" />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="ONLINE">온라인</TabsTrigger>
            <TabsTrigger value="OFFLINE">오프라인</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs"
              onClick={() => setViewMode('table')}
            >
              <Table2 className="h-3.5 w-3.5" /> 테이블
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-3.5 w-3.5" /> 캘린더
            </Button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className="space-y-4 pt-4">
            <CalendarView
              events={calendarEvents}
              onDateClick={(date, events) => setCalendarSelectedDate({ date, events })}
              maxEventsPerCell={3}
            />
            <Dialog open={!!calendarSelectedDate} onOpenChange={(v) => !v && setCalendarSelectedDate(null)}>
              <DialogContent className="max-h-[80vh] max-w-sm overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{calendarSelectedDate?.date} 납품 내역</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  {calendarSelectedDate?.events.map((evt) => (
                    <div key={evt.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">{evt.label}</p>
                        <p className="text-muted-foreground text-xs">{evt.sublabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : null}

        <TabsContent value="ONLINE" className={viewMode === 'calendar' ? 'hidden' : ''}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {onlineCreateDialog}
              <Button variant="outline" size="sm" onClick={handleDeliveryTemplateDownload}>
                <FileDown className="mr-1 h-3.5 w-3.5" /> 납품 템플릿
              </Button>
              <Button variant="outline" size="sm" onClick={() => deliveryImportFileRef.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> 엑셀 업로드
              </Button>
              <input
                ref={deliveryImportFileRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleDeliveryImport}
              />
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

        <TabsContent value="OFFLINE" className={viewMode === 'calendar' ? 'hidden' : ''}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">{offlineCreateDialog}</div>
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

      {/* 품질검사 다이얼로그 (페이지 레벨) */}
      {qualityInspectionDialog}
      {qualityViewDialog}
    </div>
  )
}
