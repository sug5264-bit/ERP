'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
// PageHeader moved to parent
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatCurrency, getLocalDateString } from '@/lib/format'
import { COMPANY_NAME } from '@/lib/constants'
import { exportToExcel, exportToPDF, downloadImportTemplate, readExcelFile, type ExportColumn } from '@/lib/export'
import {
  generateTransactionStatementPDF,
  generateDeliveryStatementPDF,
  type TransactionStatementPDFData,
  type DeliveryStatementPDFData,
} from '@/lib/pdf-reports'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Upload,
  FileDown,
  ClipboardCheck,
  Eye,
  CalendarDays,
  Table2,
  CheckCircle,
  Paperclip,
  X,
  ChevronDown,
  ChevronUp,
  Printer,
  MessageSquare,
  Send,
  Reply,
  Search,
  FileImage,
  FileText as FileTextIcon,
  FileSpreadsheet as FileSpreadsheetIcon,
  File as FileIconGeneric,
  Download,
} from 'lucide-react'
import { CalendarView, type CalendarEvent } from '@/components/common/calendar-view'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { StatusBadge } from '@/components/common/status-badge'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

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

interface CompanyOption {
  id: string
  companyName: string
  bizNo: string
  ceoName: string
  address: string
  phone: string
  bankName?: string
  bankAccount?: string
  bankHolder?: string
  isDefault: boolean
}

interface OrderOption {
  id: string
  orderNo: string
  partner?: { partnerName: string } | null
}

interface ItemOption {
  id: string
  itemCode: string
  itemName: string
  barcode?: string
  specification?: string
  unit?: string
}

interface DeliveryDetailRow {
  item?: { id: string; itemName: string; barcode?: string; specification?: string; unit?: string; itemCode?: string }
  quantity: number
  unitPrice: number
  amount: number
}

interface QualityInspectionRow {
  id: string
  inspectionNo: string
  judgement: string
  overallGrade: string
  inspectionDate: string
  inspectorName: string
  sampleSize: number
  defectCount: number
  defectRate: number
  lotNo?: string
  remarks?: string
  items?: QualityInspectionItemRow[]
}

interface QualityInspectionItemRow {
  id: string
  category: string
  checkItem: string
  spec?: string
  measuredValue?: string
  result: string
  grade: string
  defectType?: string
  remarks?: string
}

interface DeliveryRow {
  id: string
  deliveryNo: string
  deliveryDate: string
  deliveryAddress?: string
  status: string
  carrier?: string
  trackingNo?: string
  orderConfirmed?: boolean
  orderConfirmedAt?: string
  shipmentCompleted?: boolean
  shipmentCompletedAt?: string
  partner?: { partnerName: string; bizNo?: string; ceoName?: string; address?: string; phone?: string }
  salesOrder?: { orderNo: string }
  details?: DeliveryDetailRow[]
  qualityInspections?: QualityInspectionRow[]
}

interface StatementItem {
  no: number
  barcode: string
  itemName: string
  spec: string
  unit: string
  qty: number
  unitPrice: number
  supplyAmount: number
  taxAmount: number
  remark: string
}

interface ApiListResponse<T> {
  data: T[]
}

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

// File icon helpers for delivery notes
function getDeliveryFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('pdf') || mimeType.includes('text') || mimeType.includes('word') || mimeType.includes('document'))
    return FileTextIcon
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheetIcon
  return FileIconGeneric
}

function getDeliveryFileTypeBadge(mimeType: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  if (mimeType.includes('pdf') || ext === 'pdf')
    return { label: 'PDF', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
  if (mimeType.includes('sheet') || mimeType.includes('excel') || ['xlsx', 'xls', 'csv'].includes(ext))
    return { label: 'Excel', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
  if (mimeType.includes('word') || mimeType.includes('document') || ['doc', 'docx'].includes(ext))
    return { label: 'Word', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
  if (mimeType.startsWith('image/'))
    return { label: '이미지', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' }
  return { label: ext.toUpperCase() || '파일', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' }
}

function _formatDeliveryFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface DeliveryNoteItem {
  id: string
  content: string
  relatedId: string
  createdAt: string
}

interface DeliveryNoteAttachment {
  id: string
  relatedId: string
  mimeType: string
  fileName: string
  fileSize?: number
}

const DELIVERY_ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.zip,.rar,.7z'

export function DeliveriesPanel() {
  const [activeTab, setActiveTab] = useState<string>('ONLINE')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<{ date: string; events: CalendarEvent[] } | null>(
    null
  )

  // ── Notes/Reply state for linked order posts ──
  const [notesExpanded, setNotesExpanded] = useState(true)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [noteSearchKeyword, setNoteSearchKeyword] = useState('')
  const replyFileInputRef = useRef<HTMLInputElement>(null)

  const handleStatementPDF = (delivery: DeliveryRow) => {
    const companies: CompanyOption[] = companyData?.data || []
    const company = companies.find((c) => c.isDefault) || companies[0]
    const details = delivery.details || []
    const items: StatementItem[] = details.map((d: DeliveryDetailRow, i: number) => {
      const amount = Number(d.amount)
      const supplyAmount = Math.round(amount / 1.1)
      const taxAmount = amount - supplyAmount
      return {
        no: i + 1,
        barcode: d.item?.barcode || '',
        itemName: d.item?.itemName || '',
        spec: d.item?.specification || '',
        unit: d.item?.unit || 'EA',
        qty: Number(d.quantity),
        unitPrice: Number(d.unitPrice),
        supplyAmount,
        taxAmount,
        remark: '',
      }
    })
    const totalQty = items.reduce((s, it) => s + it.qty, 0)
    const totalSupply = items.reduce((s, it) => s + it.supplyAmount, 0)
    const totalTax = items.reduce((s, it) => s + it.taxAmount, 0)
    const pdfData: TransactionStatementPDFData = {
      statementNo: delivery.deliveryNo,
      statementDate: formatDate(delivery.deliveryDate),
      supplier: {
        name: company?.companyName || COMPANY_NAME,
        bizNo: company?.bizNo || '',
        ceo: company?.ceoName || '',
        address: company?.address || '',
        tel: company?.phone || '',
        bankName: company?.bankName || '',
        bankAccount: company?.bankAccount || '',
        bankHolder: company?.bankHolder || '',
      },
      buyer: {
        name: delivery.partner?.partnerName || '',
        bizNo: delivery.partner?.bizNo || '',
        ceo: delivery.partner?.ceoName || '',
        address: delivery.partner?.address || '',
        tel: delivery.partner?.phone || '',
      },
      items,
      totalQty,
      totalSupply,
      totalTax,
      totalAmount: totalSupply + totalTax,
    }
    generateTransactionStatementPDF(pdfData)
    toast.success('거래명세서 PDF가 다운로드되었습니다.')
  }

  const handleDeliveryStatementPDF = (delivery: DeliveryRow) => {
    const companies: CompanyOption[] = companyData?.data || []
    const company = companies.find((c) => c.isDefault) || companies[0]
    const details = delivery.details || []
    const items = details.map((d: DeliveryDetailRow, i: number) => ({
      no: i + 1,
      itemName: d.item?.itemName || '',
      spec: d.item?.specification || '',
      unit: d.item?.unit || 'EA',
      qty: Number(d.quantity),
      unitPrice: Number(d.unitPrice),
      amount: Number(d.amount),
    }))
    const totalQty = items.reduce((s, it) => s + it.qty, 0)
    const totalAmount = items.reduce((s, it) => s + it.amount, 0)
    const pdfData: DeliveryStatementPDFData = {
      deliveryNo: delivery.deliveryNo,
      deliveryDate: formatDate(delivery.deliveryDate),
      orderNo: delivery.salesOrder?.orderNo || '',
      supplier: {
        name: company?.companyName || COMPANY_NAME,
        bizNo: company?.bizNo || '',
        ceo: company?.ceoName || '',
        address: company?.address || '',
        tel: company?.phone || '',
        bankName: company?.bankName || '',
        bankAccount: company?.bankAccount || '',
        bankHolder: company?.bankHolder || '',
      },
      buyer: {
        name: delivery.partner?.partnerName || '',
        bizNo: delivery.partner?.bizNo || '',
        ceo: delivery.partner?.ceoName || '',
        address: delivery.partner?.address || '',
        tel: delivery.partner?.phone || '',
      },
      items,
      totalQty,
      totalAmount,
      carrier: delivery.carrier || undefined,
      trackingNo: delivery.trackingNo || undefined,
    }
    generateDeliveryStatementPDF(pdfData)
    toast.success('납품명세서 PDF가 다운로드되었습니다.')
  }

  const exportColumns: ExportColumn[] = [
    { header: '납품번호', accessor: 'deliveryNo' },
    { header: '납품일', accessor: (r) => (r.deliveryDate ? formatDate(r.deliveryDate) : '') },
    { header: '발주번호', accessor: (r) => r.salesOrder?.orderNo || '' },
    { header: '거래처', accessor: (r) => r.partner?.partnerName || '' },
    { header: '품목수', accessor: (r) => `${r.details?.length || 0}건` },
    {
      header: '합계',
      accessor: (r) =>
        formatCurrency(r.details?.reduce((s: number, d: DeliveryDetailRow) => s + Number(d.amount), 0) || 0),
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
  const [details, setDetails] = useState<Detail[]>([emptyDetail()])
  const deliveryImportFileRef = useRef<HTMLInputElement>(null)
  const attachFileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // 출하완료 확인 state
  const [shipCompleteTarget, setShipCompleteTarget] = useState<string | null>(null)

  // 첨부파일 state
  const [attachDialogOpen, setAttachDialogOpen] = useState(false)
  const [attachTarget, setAttachTarget] = useState<DeliveryRow | null>(null)
  const [attachments, setAttachments] = useState<
    { id: string; fileName: string; fileSize: number; createdAt: string }[]
  >([])

  const loadAttachments = async (deliveryId: string) => {
    try {
      const res = (await api.get(`/attachments?relatedTable=Delivery&relatedId=${deliveryId}`)) as {
        data?: { id: string; fileName: string; fileSize: number; createdAt: string }[]
      }
      setAttachments(res?.data || [])
    } catch {
      setAttachments([])
    }
  }

  const openAttachDialog = (delivery: DeliveryRow) => {
    setAttachTarget(delivery)
    setAttachDialogOpen(true)
    loadAttachments(delivery.id)
  }

  const handleAttachUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !attachTarget) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('relatedTable', 'Delivery')
      formData.append('relatedId', attachTarget.id)
      await api.upload('/attachments', formData)
      toast.success('파일이 업로드되었습니다.')
      loadAttachments(attachTarget.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '파일 업로드 실패')
    }
    if (attachFileInputRef.current) attachFileInputRef.current.value = ''
  }

  const deleteAttachment = async (id: string) => {
    try {
      await api.delete(`/attachments/${id}`)
      toast.success('파일이 삭제되었습니다.')
      if (attachTarget) loadAttachments(attachTarget.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  // 품질검사 state
  const [qiOpen, setQiOpen] = useState(false)
  const [qiViewOpen, setQiViewOpen] = useState(false)
  const [qiDelivery, setQiDelivery] = useState<DeliveryRow | null>(null)
  const [qiItems, setQiItems] = useState<InspectionItemInput[]>([])
  const [qiViewData, setQiViewData] = useState<QualityInspectionRow[] | null>(null)

  const openQualityInspection = (delivery: DeliveryRow) => {
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

  const openQualityView = async (delivery: DeliveryRow) => {
    try {
      const res = await api.get(`/sales/deliveries/${delivery.id}/quality-inspection`)
      const parsed = res as { data?: QualityInspectionRow[] } | QualityInspectionRow[]
      setQiViewData(Array.isArray(parsed) ? parsed : parsed.data || [])
      setQiDelivery(delivery)
      setQiViewOpen(true)
    } catch {
      toast.error('품질검사 정보를 불러올 수 없습니다.')
    }
  }

  // Fetch deliveries filtered by salesChannel (ONLINE or OFFLINE)
  const dateParams = useMemo(() => {
    let params = ''
    if (startDate) params += `&startDate=${startDate}`
    if (endDate) params += `&endDate=${endDate}`
    return params
  }, [startDate, endDate])

  const {
    data: onlineData,
    isLoading: onlineLoading,
    isError: onlineError,
    refetch: onlineRefetch,
  } = useQuery({
    queryKey: ['sales-deliveries', 'ONLINE', startDate, endDate],
    queryFn: () =>
      api.get(`/sales/deliveries?pageSize=50&salesChannel=ONLINE${dateParams}`) as Promise<
        ApiListResponse<DeliveryRow>
      >,
  })
  const {
    data: offlineData,
    isLoading: offlineLoading,
    isError: offlineError,
    refetch: offlineRefetch,
  } = useQuery({
    queryKey: ['sales-deliveries', 'OFFLINE', startDate, endDate],
    queryFn: () =>
      api.get(`/sales/deliveries?pageSize=50&salesChannel=OFFLINE${dateParams}`) as Promise<
        ApiListResponse<DeliveryRow>
      >,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-active'],
    queryFn: () => api.get('/sales/orders?status=ORDERED&pageSize=200') as Promise<ApiListResponse<OrderOption>>,
    staleTime: 5 * 60 * 1000,
  })
  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => api.get('/inventory/items?pageSize=500') as Promise<ApiListResponse<ItemOption>>,
    staleTime: 10 * 60 * 1000,
  })
  const { data: companyData } = useQuery({
    queryKey: ['admin-company'],
    queryFn: () => api.get('/admin/company') as Promise<ApiListResponse<CompanyOption>>,
    staleTime: 30 * 60 * 1000,
  })

  // ── Fetch linked order notes (mirrored from 수주관리) and replies ──
  const { data: deliveryNotesData } = useQuery({
    queryKey: ['notes', 'DeliveryPost'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryPost') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const deliveryNotes: DeliveryNoteItem[] = deliveryNotesData?.data || []

  // Fetch reply notes (답글)
  const { data: deliveryRepliesData } = useQuery({
    queryKey: ['notes', 'DeliveryReply'],
    queryFn: () => api.get('/notes?relatedTable=DeliveryReply') as Promise<{ data: DeliveryNoteItem[] }>,
  })
  const deliveryReplies: DeliveryNoteItem[] = deliveryRepliesData?.data || []

  // Fetch attachments for reply posts
  const { data: replyAttachmentsData } = useQuery({
    queryKey: ['attachments', 'DeliveryReplyPost'],
    queryFn: () => api.get('/attachments?relatedTable=DeliveryReplyPost') as Promise<{ data: DeliveryNoteAttachment[] }>,
  })
  const replyAttachments: DeliveryNoteAttachment[] = replyAttachmentsData?.data || []

  const getRepliesForNote = (noteId: string) => deliveryReplies.filter((r) => r.relatedId === noteId)
  const getReplyAttachments = (replyId: string) => replyAttachments.filter((a) => a.relatedId === replyId)

  // Filter notes by search
  const filteredDeliveryNotes = noteSearchKeyword
    ? deliveryNotes.filter((n) => n.content.toLowerCase().includes(noteSearchKeyword.toLowerCase()))
    : deliveryNotes

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setReplyFiles((prev) => [...prev, ...Array.from(files)])
    if (replyFileInputRef.current) replyFileInputRef.current.value = ''
  }

  const handleSubmitReply = async (parentNoteId: string) => {
    if (!replyContent.trim()) {
      toast.error('답글 내용을 입력해주세요.')
      return
    }
    setReplySubmitting(true)
    try {
      const replyResult = await api.post('/notes', {
        content: replyContent.trim(),
        relatedTable: 'DeliveryReply',
        relatedId: parentNoteId,
      })
      const replyId = replyResult?.data?.id

      // Upload files
      if (replyFiles.length > 0 && replyId) {
        for (const file of replyFiles) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('relatedTable', 'DeliveryReplyPost')
          formData.append('relatedId', replyId)
          await fetch('/api/v1/attachments', { method: 'POST', body: formData }).catch(() => {
            toast.error(`"${file.name}" 업로드 실패`)
          })
        }
      }

      // Auto-change related deliveries to ORDER_CONFIRMED (수주대기) status
      // We mark all PREPARING deliveries to indicate they've been acknowledged
      const preparingDeliveries = [...onlineDeliveries, ...offlineDeliveries].filter(
        (d) => d.status === 'PREPARING' && !d.orderConfirmed
      )
      for (const d of preparingDeliveries.slice(0, 1)) {
        await api.patch(`/sales/deliveries/${d.id}`, {
          orderConfirmed: true,
          orderConfirmedAt: new Date().toISOString(),
        }).catch(() => {})
      }

      queryClient.invalidateQueries({ queryKey: ['notes', 'DeliveryReply'] })
      queryClient.invalidateQueries({ queryKey: ['attachments', 'DeliveryReplyPost'] })
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setReplyContent('')
      setReplyFiles([])
      setReplyingTo(null)
      toast.success('답글이 등록되었습니다. 수주대기 상태로 변경되었습니다.')
    } catch {
      toast.error('답글 등록에 실패했습니다.')
    }
    setReplySubmitting(false)
  }

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/deliveries', body),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setOpen(false)
      setDetails([emptyDetail()])
      toast.success('납품이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const qiMutation = useMutation({
    mutationFn: (body: Record<string, unknown> & { deliveryId: string }) =>
      api.post(`/sales/deliveries/${body.deliveryId}/quality-inspection`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      setQiOpen(false)
      setQiDelivery(null)
      setQiItems([])
      toast.success('품질검사가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const shipCompleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/sales/deliveries/${id}`, { status: 'SHIPPED', completedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-deliveries'] })
      toast.success('출하완료 처리되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleShipComplete = (id: string) => {
    setShipCompleteTarget(id)
  }

  const orders = ordersData?.data || []
  const items = itemsData?.data || []
  const onlineDeliveries = useMemo(() => onlineData?.data || [], [onlineData?.data])
  const offlineDeliveries = useMemo(() => offlineData?.data || [], [offlineData?.data])

  // 기간별 납품 수량/금액 요약
  const periodSummary = useMemo(() => {
    const deliveries = activeTab === 'ONLINE' ? onlineDeliveries : offlineDeliveries
    let totalQty = 0
    let totalAmt = 0
    deliveries.forEach((d: DeliveryRow) => {
      d.details?.forEach((det) => {
        totalQty += Number(det.quantity) || 0
        totalAmt += Number(det.amount) || 0
      })
    })
    return { count: deliveries.length, totalQty, totalAmt }
  }, [activeTab, onlineDeliveries, offlineDeliveries])

  // Calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const deliveries = activeTab === 'ONLINE' ? onlineDeliveries : offlineDeliveries
    const statusVariant: Record<string, CalendarEvent['variant']> = {
      PREPARING: 'warning',
      SHIPPED: 'info',
      DELIVERED: 'success',
    }
    return deliveries.map((d: DeliveryRow) => ({
      id: d.id,
      date: d.deliveryDate?.split('T')[0] || '',
      label: `${d.deliveryNo} ${d.partner?.partnerName || ''}`.trim(),
      sublabel: `${STATUS_MAP[d.status] || d.status} · ${d.details?.length || 0}건`,
      variant: statusVariant[d.status] || 'default',
    }))
  }, [activeTab, onlineDeliveries, offlineDeliveries])

  const updateDetail = (idx: number, field: keyof Detail, value: string | number) => {
    const d = [...details]
    ;(d[idx] as Record<keyof Detail, string | number>)[field] = value
    setDetails(d)
  }

  const updateQiItem = (idx: number, field: keyof InspectionItemInput, value: string) => {
    const items = [...qiItems]
    ;(items[idx] as Record<keyof InspectionItemInput, string>)[field] = value
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

  const handleDeliveryTemplateDownload = () => {
    // 회사 정보 가져오기
    const companies = companyData?.data || []
    const company = companies.find((c: CompanyOption) => c.isDefault) || companies[0]
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
        { header: '내품명', key: 'itemName', example: '품목명', width: 18 },
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
      const normalize = (s: unknown) => (s ? String(s).trim().toLowerCase() : '')
      const today = getLocalDateString()
      for (const row of rows) {
        const orderNoVal = normalize(row.orderNo)
        const order = orders.find((o: OrderOption) => normalize(o.orderNo) === orderNoVal)
        const nameVal = normalize(row.itemName)
        const codeVal = normalize(row.itemCode)
        // 품목 매칭: 품목명(정확) → 품목코드(정확) → 부분 포함
        const item =
          items.find(
            (it: ItemOption) =>
              (nameVal && normalize(it.itemName) === nameVal) ||
              (nameVal && normalize(it.itemCode) === nameVal) ||
              (codeVal && normalize(it.itemCode) === codeVal)
          ) ||
          items.find(
            (it: ItemOption) =>
              (nameVal && normalize(it.itemName).includes(nameVal)) ||
              (codeVal && normalize(it.itemName).includes(codeVal))
          )
        if (!item) {
          failCount++
          failReasons.push(`품목명 "${row.itemName || row.itemCode}" 미매칭`)
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
        } catch (err: unknown) {
          failCount++
          failReasons.push(err instanceof Error ? err.message : `납품 생성 실패`)
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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '엑셀 파일을 읽을 수 없습니다.')
    }
    if (deliveryImportFileRef.current) deliveryImportFileRef.current.value = ''
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
    return companies.find((c: CompanyOption) => c.isDefault) || companies[0] || {}
  })()

  // ── 온라인: 택배 양식 (보내는분/받는분 + 품목 테이블) ──
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
                  {orders.map((o: OrderOption) => (
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
                      품목(바코드) <span className="text-destructive">*</span>
                    </th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">수량</th>
                    <th className="px-2 py-2 text-right font-medium whitespace-nowrap">단가</th>
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
                              {items.map((it: ItemOption) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.barcode || it.itemCode} - {it.itemName}
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
                  {orders.map((o: OrderOption) => (
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
                      품목(바코드) <span className="text-destructive">*</span>
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
                              {items.map((it: ItemOption) => (
                                <SelectItem key={it.id} value={it.id}>
                                  {it.barcode || it.itemCode} - {it.itemName}
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
            {qiViewData.map((inspection: QualityInspectionRow) => (
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
                      {(inspection.items || []).map((item: QualityInspectionItemRow) => (
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
      {/* ── 수주관리 글 연동 & 답글 섹션 ── */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setNotesExpanded(!notesExpanded)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">수주관리 글 / 답글</span>
            <Badge variant="secondary" className="text-[10px]">{filteredDeliveryNotes.length}건</Badge>
          </div>
          {notesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {notesExpanded && (
          <div className="border-t px-4 py-3 space-y-3">
            <div className="relative max-w-xs">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9 h-8 text-xs"
                placeholder="글 검색..."
                value={noteSearchKeyword}
                onChange={(e) => setNoteSearchKeyword(e.target.value)}
              />
            </div>
            {filteredDeliveryNotes.length === 0 && (
              <p className="text-muted-foreground text-center text-xs py-6">수주관리에서 작성된 글이 없습니다.</p>
            )}
            {filteredDeliveryNotes.map((note) => {
              // Parse content: remove [수주글] prefix
              const displayContent = note.content.replace(/^\[수주글\]\n?/, '')
              const channelMatch = displayContent.match(/^\[(온라인|오프라인)\]/)
              const channelType = channelMatch ? channelMatch[1] : null
              const afterChannel = channelMatch ? displayContent.slice(channelMatch[0].length) : displayContent
              const titleMatch = afterChannel.match(/^\[(.+?)\]\n?/)
              const title = titleMatch ? titleMatch[1] : null
              const body = titleMatch ? afterChannel.slice(titleMatch[0].length) : afterChannel.replace(/^\n/, '')
              const replies = getRepliesForNote(note.id)

              return (
                <div key={note.id} className="rounded-md border">
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">수주</Badge>
                      {channelType && (
                        <Badge variant={channelType === '온라인' ? 'default' : 'secondary'} className="text-[10px]">
                          {channelType}
                        </Badge>
                      )}
                      <span className="text-muted-foreground text-[10px]">{formatDate(note.createdAt)}</span>
                    </div>
                    {title && <p className="text-sm font-medium">{title}</p>}
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{body.slice(0, 200)}{body.length > 200 ? '...' : ''}</p>

                    {/* Replies */}
                    {replies.length > 0 && (
                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-emerald-200 dark:border-emerald-800">
                        {replies.map((reply) => {
                          const replyFiles = getReplyAttachments(reply.id)
                          return (
                            <div key={reply.id} className="rounded-md bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">답글</Badge>
                                <span className="text-muted-foreground text-[10px]">{formatDate(reply.createdAt)}</span>
                              </div>
                              <p className="text-xs whitespace-pre-wrap">{reply.content}</p>
                              {replyFiles.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {replyFiles.map((att) => {
                                    const Icon = getDeliveryFileIcon(att.mimeType)
                                    const typeBadge = getDeliveryFileTypeBadge(att.mimeType, att.fileName)
                                    return (
                                      <button
                                        key={att.id}
                                        onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                                        className="bg-white dark:bg-transparent flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                                      >
                                        <Icon className="h-3 w-3" />
                                        <span className="max-w-[120px] truncate">{att.fileName}</span>
                                        <span className={`rounded px-0.5 text-[8px] font-medium ${typeBadge.color}`}>{typeBadge.label}</span>
                                        <Download className="h-2.5 w-2.5" />
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Reply button / form */}
                    {replyingTo === note.id ? (
                      <div className="mt-2 space-y-2 rounded-md border bg-muted/20 p-3">
                        <Textarea
                          placeholder="답글을 입력하세요..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={3}
                          className="text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => replyFileInputRef.current?.click()}
                          >
                            <Paperclip className="mr-1 h-3 w-3" /> 파일 첨부
                          </Button>
                          <input
                            ref={replyFileInputRef}
                            type="file"
                            accept={DELIVERY_ACCEPTED_TYPES}
                            multiple
                            className="hidden"
                            onChange={handleReplyFileSelect}
                          />
                          {replyFiles.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {replyFiles.map((f, idx) => (
                                <span key={idx} className="bg-muted flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]">
                                  <Paperclip className="h-2.5 w-2.5" /> {f.name}
                                  <button type="button" onClick={() => setReplyFiles(replyFiles.filter((_, i) => i !== idx))} className="text-destructive ml-0.5">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setReplyingTo(null); setReplyContent(''); setReplyFiles([]) }}>
                            취소
                          </Button>
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleSubmitReply(note.id)} disabled={!replyContent.trim() || replySubmitting}>
                            <Send className="mr-1 h-3 w-3" /> {replySubmitting ? '등록 중...' : '답글 등록'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 gap-1 text-xs text-blue-600 hover:text-blue-700"
                        onClick={() => setReplyingTo(note.id)}
                      >
                        <Reply className="h-3 w-3" /> 답글 달기
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

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

        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
          className="pt-2"
        />

        {(startDate || endDate) && (
          <div className="grid grid-cols-3 gap-4 pt-1">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-muted-foreground text-xs">납품건수</p>
              <p className="text-lg font-semibold">{periodSummary.count}건</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-muted-foreground text-xs">총 수량</p>
              <p className="text-lg font-semibold">{periodSummary.totalQty.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-muted-foreground text-xs">총 금액</p>
              <p className="text-lg font-semibold">{formatCurrency(periodSummary.totalAmt)}</p>
            </div>
          </div>
        )}

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
            </div>
            {/* BBS Board Style */}
            <div className="overflow-hidden rounded-lg border">
              <div className="bg-muted/50 hidden grid-cols-[50px_1fr_120px_100px_80px_120px] items-center gap-2 border-b px-4 py-2 text-xs font-medium sm:grid">
                <span>번호</span>
                <span>제목</span>
                <span>거래처</span>
                <span className="text-right">합계</span>
                <span className="text-center">상태</span>
                <span className="text-right">납품일</span>
              </div>
              {onlineLoading && <div className="text-muted-foreground py-12 text-center text-sm">불러오는 중...</div>}
              {onlineError && (
                <div className="py-12 text-center">
                  <p className="text-destructive mb-2 text-sm">데이터를 불러오지 못했습니다.</p>
                  <Button variant="outline" size="sm" onClick={() => onlineRefetch()}>
                    다시 시도
                  </Button>
                </div>
              )}
              {!onlineLoading && !onlineError && onlineDeliveries.length === 0 && (
                <div className="text-muted-foreground py-12 text-center text-sm">등록된 납품이 없습니다.</div>
              )}
              {onlineDeliveries.map((delivery, idx) => {
                const isExpanded = expandedId === delivery.id
                const postNo = onlineDeliveries.length - idx
                const totalAmount =
                  delivery.details?.reduce((s: number, d: DeliveryDetailRow) => s + Number(d.amount), 0) || 0
                const title = `${delivery.deliveryNo} ${delivery.salesOrder?.orderNo ? `(${delivery.salesOrder.orderNo})` : ''}`
                const inspection = delivery.qualityInspections?.[0]
                const qs = inspection
                  ? QUALITY_STATUS_MAP[inspection.judgement] || {
                      label: inspection.judgement,
                      variant: 'outline' as const,
                    }
                  : null
                const grade = inspection ? GRADE_MAP[inspection.overallGrade] : null
                return (
                  <div key={delivery.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      className="hover:bg-muted/30 flex w-full items-center gap-2 px-4 py-3 text-left transition-colors sm:grid sm:grid-cols-[50px_1fr_120px_100px_80px_120px]"
                      onClick={() => setExpandedId(isExpanded ? null : delivery.id)}
                    >
                      <span className="text-muted-foreground hidden text-xs sm:block">{postNo}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{title}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {delivery.details?.length || 0}건
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronDown className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
                          )}
                        </div>
                      </div>
                      <span className="hidden text-xs sm:block">{delivery.partner?.partnerName || '-'}</span>
                      <span className="hidden text-right text-sm font-bold sm:block">
                        {formatCurrency(totalAmount)}
                      </span>
                      <span className="hidden text-center sm:block">
                        <StatusBadge status={delivery.status} labels={STATUS_MAP} />
                      </span>
                      <span className="text-muted-foreground hidden text-right text-xs sm:block">
                        {formatDate(delivery.deliveryDate)}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-white px-4 py-4 sm:pl-[66px] dark:bg-transparent">
                        {/* Delivery info */}
                        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                          <div>
                            <span className="text-muted-foreground text-xs">납품번호</span>
                            <p className="font-mono text-sm">{delivery.deliveryNo}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">발주번호</span>
                            <p className="font-mono text-sm">{delivery.salesOrder?.orderNo || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">운송장</span>
                            <p className="font-mono text-sm">{delivery.trackingNo || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">택배사</span>
                            <p className="text-sm">{delivery.carrier || '-'}</p>
                          </div>
                        </div>
                        {delivery.deliveryAddress && (
                          <div className="mb-3">
                            <span className="text-muted-foreground text-xs">납품주소</span>
                            <p className="text-sm">{delivery.deliveryAddress}</p>
                          </div>
                        )}
                        {/* Quality inspection */}
                        {inspection && (
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">품질검사:</span>
                            <Badge variant={qs!.variant} className="text-xs">
                              {qs!.label}
                            </Badge>
                            {grade && <span className={`text-xs font-medium ${grade.color}`}>{grade.label}</span>}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openQualityView(delivery)}
                              title="검사 상세"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {/* Items */}
                        {delivery.details && delivery.details.length > 0 && (
                          <div className="mb-3">
                            <p className="text-muted-foreground mb-1 text-xs font-medium">품목 내역</p>
                            <div className="overflow-x-auto rounded-md border">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/50 border-b">
                                    <th className="px-2 py-1.5 text-left font-medium">품목명</th>
                                    <th className="px-2 py-1.5 text-left font-medium">바코드</th>
                                    <th className="px-2 py-1.5 text-right font-medium">수량</th>
                                    <th className="px-2 py-1.5 text-right font-medium">단가</th>
                                    <th className="px-2 py-1.5 text-right font-medium">금액</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {delivery.details.map((d: DeliveryDetailRow, dIdx: number) => (
                                    <tr key={dIdx} className="border-b last:border-b-0">
                                      <td className="px-2 py-1.5">{d.item?.itemName || '-'}</td>
                                      <td className="px-2 py-1.5 font-mono">{d.item?.barcode || '-'}</td>
                                      <td className="px-2 py-1.5 text-right">
                                        {Number(d.quantity)} {d.item?.unit || 'EA'}
                                      </td>
                                      <td className="px-2 py-1.5 text-right">{formatCurrency(Number(d.unitPrice))}</td>
                                      <td className="px-2 py-1.5 text-right font-medium">
                                        {formatCurrency(Number(d.amount))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {/* Attachments */}
                        <div className="mb-3 flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0 pt-0.5 text-xs font-medium">첨부</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                              onClick={() => handleStatementPDF(delivery)}
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>거래명세서.pdf</span>
                            </button>
                            <button
                              type="button"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                              onClick={() => handleDeliveryStatementPDF(delivery)}
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>납품명세서.pdf</span>
                            </button>
                            <button
                              type="button"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                              onClick={() => openAttachDialog(delivery)}
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>첨부파일 관리</span>
                            </button>
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                          {delivery.status === 'PREPARING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleShipComplete(delivery.id)}
                              disabled={shipCompleteMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" /> 출하완료
                            </Button>
                          )}
                          {!inspection && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => openQualityInspection(delivery)}
                            >
                              <ClipboardCheck className="h-3 w-3" /> 검사등록
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              exportToExcel({
                                fileName: `납품_${delivery.deliveryNo}`,
                                title: `납품 ${delivery.deliveryNo}`,
                                columns: exportColumns,
                                data: [delivery],
                              })
                            }}
                          >
                            <Printer className="h-3 w-3" /> 인쇄
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="OFFLINE" className={viewMode === 'calendar' ? 'hidden' : ''}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">{offlineCreateDialog}</div>
            {/* BBS Board Style */}
            <div className="overflow-hidden rounded-lg border">
              <div className="bg-muted/50 hidden grid-cols-[50px_1fr_120px_100px_80px_120px] items-center gap-2 border-b px-4 py-2 text-xs font-medium sm:grid">
                <span>번호</span>
                <span>제목</span>
                <span>거래처</span>
                <span className="text-right">합계</span>
                <span className="text-center">상태</span>
                <span className="text-right">납품일</span>
              </div>
              {offlineLoading && <div className="text-muted-foreground py-12 text-center text-sm">불러오는 중...</div>}
              {offlineError && (
                <div className="py-12 text-center">
                  <p className="text-destructive mb-2 text-sm">데이터를 불러오지 못했습니다.</p>
                  <Button variant="outline" size="sm" onClick={() => offlineRefetch()}>
                    다시 시도
                  </Button>
                </div>
              )}
              {!offlineLoading && !offlineError && offlineDeliveries.length === 0 && (
                <div className="text-muted-foreground py-12 text-center text-sm">등록된 납품이 없습니다.</div>
              )}
              {offlineDeliveries.map((delivery, idx) => {
                const isExpanded = expandedId === delivery.id
                const postNo = offlineDeliveries.length - idx
                const totalAmount =
                  delivery.details?.reduce((s: number, d: DeliveryDetailRow) => s + Number(d.amount), 0) || 0
                const title = `${delivery.deliveryNo} ${delivery.salesOrder?.orderNo ? `(${delivery.salesOrder.orderNo})` : ''}`
                const inspection = delivery.qualityInspections?.[0]
                const qs = inspection
                  ? QUALITY_STATUS_MAP[inspection.judgement] || {
                      label: inspection.judgement,
                      variant: 'outline' as const,
                    }
                  : null
                const grade = inspection ? GRADE_MAP[inspection.overallGrade] : null
                return (
                  <div key={delivery.id} className="border-b last:border-b-0">
                    <button
                      type="button"
                      className="hover:bg-muted/30 flex w-full items-center gap-2 px-4 py-3 text-left transition-colors sm:grid sm:grid-cols-[50px_1fr_120px_100px_80px_120px]"
                      onClick={() => setExpandedId(isExpanded ? null : delivery.id)}
                    >
                      <span className="text-muted-foreground hidden text-xs sm:block">{postNo}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{title}</span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {delivery.details?.length || 0}건
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronDown className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
                          )}
                        </div>
                      </div>
                      <span className="hidden text-xs sm:block">{delivery.partner?.partnerName || '-'}</span>
                      <span className="hidden text-right text-sm font-bold sm:block">
                        {formatCurrency(totalAmount)}
                      </span>
                      <span className="hidden text-center sm:block">
                        <StatusBadge status={delivery.status} labels={STATUS_MAP} />
                      </span>
                      <span className="text-muted-foreground hidden text-right text-xs sm:block">
                        {formatDate(delivery.deliveryDate)}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-white px-4 py-4 sm:pl-[66px] dark:bg-transparent">
                        <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                          <div>
                            <span className="text-muted-foreground text-xs">납품번호</span>
                            <p className="font-mono text-sm">{delivery.deliveryNo}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">발주번호</span>
                            <p className="font-mono text-sm">{delivery.salesOrder?.orderNo || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">운송장</span>
                            <p className="font-mono text-sm">{delivery.trackingNo || '-'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">택배사</span>
                            <p className="text-sm">{delivery.carrier || '-'}</p>
                          </div>
                        </div>
                        {delivery.deliveryAddress && (
                          <div className="mb-3">
                            <span className="text-muted-foreground text-xs">납품주소</span>
                            <p className="text-sm">{delivery.deliveryAddress}</p>
                          </div>
                        )}
                        {inspection && (
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-muted-foreground text-xs">품질검사:</span>
                            <Badge variant={qs!.variant} className="text-xs">
                              {qs!.label}
                            </Badge>
                            {grade && <span className={`text-xs font-medium ${grade.color}`}>{grade.label}</span>}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => openQualityView(delivery)}
                              title="검사 상세"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {delivery.details && delivery.details.length > 0 && (
                          <div className="mb-3">
                            <p className="text-muted-foreground mb-1 text-xs font-medium">품목 내역</p>
                            <div className="overflow-x-auto rounded-md border">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-muted/50 border-b">
                                    <th className="px-2 py-1.5 text-left font-medium">품목명</th>
                                    <th className="px-2 py-1.5 text-left font-medium">바코드</th>
                                    <th className="px-2 py-1.5 text-right font-medium">수량</th>
                                    <th className="px-2 py-1.5 text-right font-medium">단가</th>
                                    <th className="px-2 py-1.5 text-right font-medium">금액</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {delivery.details.map((d: DeliveryDetailRow, dIdx: number) => (
                                    <tr key={dIdx} className="border-b last:border-b-0">
                                      <td className="px-2 py-1.5">{d.item?.itemName || '-'}</td>
                                      <td className="px-2 py-1.5 font-mono">{d.item?.barcode || '-'}</td>
                                      <td className="px-2 py-1.5 text-right">
                                        {Number(d.quantity)} {d.item?.unit || 'EA'}
                                      </td>
                                      <td className="px-2 py-1.5 text-right">{formatCurrency(Number(d.unitPrice))}</td>
                                      <td className="px-2 py-1.5 text-right font-medium">
                                        {formatCurrency(Number(d.amount))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <div className="mb-3 flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0 pt-0.5 text-xs font-medium">첨부</span>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                              onClick={() => handleStatementPDF(delivery)}
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>거래명세서.pdf</span>
                            </button>
                            <button
                              type="button"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                              onClick={() => handleDeliveryStatementPDF(delivery)}
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>납품명세서.pdf</span>
                            </button>
                            <button
                              type="button"
                              className="text-primary flex items-center gap-1 text-xs hover:underline"
                              onClick={() => openAttachDialog(delivery)}
                            >
                              <Paperclip className="h-3 w-3" />
                              <span>첨부파일 관리</span>
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                          {delivery.status === 'PREPARING' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => handleShipComplete(delivery.id)}
                              disabled={shipCompleteMutation.isPending}
                            >
                              <CheckCircle className="h-3 w-3" /> 출하완료
                            </Button>
                          )}
                          {!inspection && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => openQualityInspection(delivery)}
                            >
                              <ClipboardCheck className="h-3 w-3" /> 검사등록
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              exportToExcel({
                                fileName: `납품_${delivery.deliveryNo}`,
                                title: `납품 ${delivery.deliveryNo}`,
                                columns: exportColumns,
                                data: [delivery],
                              })
                            }}
                          >
                            <Printer className="h-3 w-3" /> 인쇄
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 품질검사 다이얼로그 (페이지 레벨) */}
      {qualityInspectionDialog}
      {qualityViewDialog}

      {/* 출하완료 확인 다이얼로그 */}
      <ConfirmDialog
        open={!!shipCompleteTarget}
        onOpenChange={(open) => !open && setShipCompleteTarget(null)}
        title="출하완료 처리"
        description="출하완료 처리하시겠습니까?"
        confirmLabel="출하완료"
        onConfirm={() => {
          if (shipCompleteTarget) shipCompleteMutation.mutate(shipCompleteTarget)
          setShipCompleteTarget(null)
        }}
        isPending={shipCompleteMutation.isPending}
      />

      {/* 첨부파일 관리 다이얼로그 */}
      <Dialog open={attachDialogOpen} onOpenChange={setAttachDialogOpen}>
        <DialogContent className="max-w-sm sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>첨부파일 - {attachTarget?.deliveryNo}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            거래명세서, 인수증 등 출고 관련 서류를 업로드할 수 있습니다. (Excel, PDF, 이미지 등)
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => attachFileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> 파일 업로드
              </Button>
              <input
                ref={attachFileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.gif,.zip"
                onChange={handleAttachUpload}
              />
              <span className="text-muted-foreground text-xs">최대 50MB</span>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-1">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{att.fileName}</p>
                        <p className="text-muted-foreground text-[10px]">
                          {att.fileSize < 1024 * 1024
                            ? `${(att.fileSize / 1024).toFixed(1)}KB`
                            : `${(att.fileSize / (1024 * 1024)).toFixed(1)}MB`}
                          {' · '}
                          {formatDate(att.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={`/api/v1/attachments/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-muted rounded p-1"
                        title="다운로드"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteAttachment(att.id)}
                        title="삭제"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-xs">첨부파일이 없습니다.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
