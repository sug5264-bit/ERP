'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { formatDate } from '@/lib/format'
import { readExcelFile } from '@/lib/export/excel-reader'
import { downloadImportTemplate } from '@/lib/export/excel-template'
import { exportToExcel } from '@/lib/export/excel-export'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Search,
  Package,
  ShoppingCart,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader2,
  ArrowRight,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Pencil,
} from 'lucide-react'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'

interface Partner {
  id: string
  partnerCode: string
  partnerName: string
  bizNo?: string
  ceoName?: string
  address?: string
  phone?: string
}

interface Item {
  id: string
  itemCode: string
  itemName: string
  specification?: string
  unit: string
  standardPrice: number
  taxType?: string
  barcode?: string
}

interface OrderDetail {
  itemId: string
  itemName?: string
  quantity: number
  unitPrice: number
  supplyAmount: number
  taxAmount: number
  amount: number
  remark?: string
}

interface SalesOrder {
  id: string
  orderNo: string
  orderDate: string
  status: string
  salesChannel: string
  totalAmount: number
  totalSupply: number
  totalTax: number
  vatIncluded: boolean
  description?: string
  partner?: Partner
  details?: {
    id: string
    itemId: string
    quantity: number
    unitPrice: number
    supplyAmount: number
    taxAmount: number
    totalAmount: number
    deliveredQty: number
    remainingQty: number
    item?: Item
    remark?: string
  }[]
}

function getLocalDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ORDERED: { label: '발주완료', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  IN_PROGRESS: { label: '진행중', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED: { label: '완료', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  CANCELLED: { label: '취소', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
}

const EXCEL_KEY_MAP: Record<string, string> = {
  거래처코드: 'partnerCode',
  거래처명: 'partnerName',
  사업자번호: 'bizNo',
  품목코드: 'itemCode',
  품목명: 'itemName',
  규격: 'specification',
  단위: 'unit',
  수량: 'quantity',
  단가: 'unitPrice',
  비고: 'remark',
  발주일: 'orderDate',
  납기일: 'deliveryDate',
  부가세: 'vatType',
  바코드: 'barcode',
  발주그룹: 'orderGroupNo',
}

export default function ShipperOfflineOrdersPage() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const [kpiYear, setKpiYear] = useState(now.getFullYear())
  const [kpiMonth, setKpiMonth] = useState(now.getMonth() + 1)
  const { start: monthStart, end: monthEnd } = useMemo(() => getMonthRange(kpiYear, kpiMonth), [kpiYear, kpiMonth])

  const [searchKeyword, setSearchKeyword] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null)

  // Create form
  const [orderDate, setOrderDate] = useState(getLocalDateString())
  const [partnerId, setPartnerId] = useState('')
  const [partnerSearch, setPartnerSearch] = useState('')
  const [description, setDescription] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [vatIncluded, setVatIncluded] = useState(true)
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([
    { itemId: '', itemName: '', quantity: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0, amount: 0 },
  ])

  // Excel import
  const [excelPreview, setExcelPreview] = useState<Record<string, unknown>[] | null>(null)
  const [excelDialogOpen, setExcelDialogOpen] = useState(false)
  const [excelErrors, setExcelErrors] = useState<string[]>([])

  // Queries
  const dateParams = useMemo(() => {
    let params = '&salesChannel=OFFLINE'
    params += `&startDate=${monthStart}&endDate=${monthEnd}`
    if (searchKeyword) params += `&search=${encodeURIComponent(searchKeyword)}`
    return params
  }, [monthStart, monthEnd, searchKeyword])

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['shipper-offline-orders', monthStart, monthEnd, searchKeyword],
    queryFn: () => api.get(`/sales/orders?pageSize=500${dateParams}`) as Promise<{ data: SalesOrder[] }>,
  })
  const allOrders = ordersData?.data || []
  const orders = useMemo(() => {
    if (statusFilter === 'all') return allOrders
    if (statusFilter === 'active') return allOrders.filter((o) => o.status !== 'CANCELLED')
    return allOrders.filter((o) => o.status === statusFilter)
  }, [allOrders, statusFilter])

  const { data: detailData } = useQuery({
    queryKey: ['shipper-order-detail', detailOrder?.id],
    queryFn: () =>
      api.get(`/sales/orders/${detailOrder?.id}`) as Promise<{
        data: SalesOrder & {
          deliveries?: {
            id: string
            deliveryNo: string
            deliveryDate: string
            details: { itemId: string; quantity: number; item?: Item }[]
          }[]
        }
      }>,
    enabled: !!detailOrder?.id,
  })

  const { data: partnersData } = useQuery({
    queryKey: ['partners-list'],
    queryFn: () => api.get('/partners?pageSize=500') as Promise<{ data: Partner[] }>,
    staleTime: 5 * 60 * 1000,
  })
  const partners = partnersData?.data || []

  const { data: itemsData } = useQuery({
    queryKey: ['items-list'],
    queryFn: () => api.get('/inventory/items?pageSize=500&isActive=true') as Promise<{ data: Item[] }>,
    staleTime: 5 * 60 * 1000,
  })
  const items = itemsData?.data || []

  const filteredPartners = useMemo(() => {
    if (!partnerSearch) return partners.slice(0, 20)
    const q = partnerSearch.toLowerCase()
    return partners
      .filter(
        (p) =>
          p.partnerName.toLowerCase().includes(q) ||
          p.partnerCode.toLowerCase().includes(q) ||
          (p.bizNo && p.bizNo.includes(q))
      )
      .slice(0, 20)
  }, [partners, partnerSearch])

  // Stats
  const stats = useMemo(() => {
    const activeOrders = allOrders.filter((o) => o.status !== 'CANCELLED')
    const total = activeOrders.length
    const ordered = activeOrders.filter((o) => o.status === 'ORDERED').length
    const inProgress = activeOrders.filter((o) => o.status === 'IN_PROGRESS').length
    const completed = activeOrders.filter((o) => o.status === 'COMPLETED').length
    const totalAmount = activeOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0)
    const fulfillmentRate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { total, ordered, inProgress, completed, totalAmount, fulfillmentRate }
  }, [allOrders])

  const calcTax = useCallback(
    (supplyAmount: number, itemId: string, isVatIncluded: boolean): number => {
      if (!isVatIncluded) return 0
      const item = items.find((i) => i.id === itemId)
      const taxType = item?.taxType || 'TAXABLE'
      return taxType === 'TAXABLE' ? Math.round(supplyAmount * 0.1) : 0
    },
    [items]
  )

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const validDetails = orderDetails.filter((d) => (d.itemId || d.itemName) && d.quantity > 0)
      if (validDetails.length === 0) throw new Error('최소 1개 이상의 품목을 입력하세요')
      if (!orderDate) throw new Error('발주일을 입력하세요')

      return api.post('/sales/orders', {
        orderDate,
        partnerId: partnerId || undefined,
        salesChannel: 'OFFLINE',
        deliveryDate: deliveryDate || undefined,
        description: description || undefined,
        vatIncluded,
        details: validDetails.map((d) => ({
          itemId: d.itemId || undefined,
          itemName: d.itemName || undefined,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          remark: d.remark || undefined,
        })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-offline-orders'] })
      resetForm()
      setCreateOpen(false)
      toast.success('오프라인 발주가 등록되었습니다.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '발주 등록에 실패했습니다.')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-offline-orders'] })
      setDeleteTarget(null)
      toast.success('발주가 삭제되었습니다.')
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })

  // Excel import mutation
  const excelImportMutation = useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const grouped = new Map<string, Record<string, unknown>[]>()
      for (const row of rows) {
        const groupKey = row.orderGroupNo
          ? String(row.orderGroupNo)
          : `${row.orderDate || getLocalDateString()}|${row.partnerCode || row.partnerName || 'none'}`
        if (!grouped.has(groupKey)) grouped.set(groupKey, [])
        grouped.get(groupKey)!.push(row)
      }

      const results = []
      for (const [, groupRows] of grouped) {
        const first = groupRows[0]
        const vatType = String(first.vatType || '포함')
        const isVat = vatType !== '별도' && vatType !== 'false' && vatType !== '0'

        const result = await api.post('/sales/orders', {
          orderDate: String(first.orderDate || getLocalDateString()),
          partnerCode: first.partnerCode ? String(first.partnerCode) : undefined,
          partnerName: first.partnerName ? String(first.partnerName) : undefined,
          bizNo: first.bizNo ? String(first.bizNo) : undefined,
          salesChannel: 'OFFLINE',
          deliveryDate: first.deliveryDate ? String(first.deliveryDate) : undefined,
          vatIncluded: isVat,
          details: groupRows.map((r) => ({
            itemCode: r.itemCode ? String(r.itemCode) : undefined,
            itemName: r.itemName ? String(r.itemName) : undefined,
            specification: r.specification ? String(r.specification) : undefined,
            unit: r.unit ? String(r.unit) : undefined,
            barcode: r.barcode ? String(r.barcode) : undefined,
            quantity: Number(r.quantity) || 1,
            unitPrice: Number(r.unitPrice) || 0,
            remark: r.remark ? String(r.remark) : undefined,
          })),
        })
        results.push(result)
      }
      return results
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['shipper-offline-orders'] })
      setExcelPreview(null)
      setExcelDialogOpen(false)
      toast.success(`${results.length}건의 발주가 등록되었습니다.`)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : '엑셀 업로드에 실패했습니다.')
    },
  })

  const resetForm = () => {
    setOrderDate(getLocalDateString())
    setPartnerId('')
    setPartnerSearch('')
    setDescription('')
    setDeliveryDate('')
    setVatIncluded(true)
    setOrderDetails([{ itemId: '', itemName: '', quantity: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0, amount: 0 }])
  }

  const updateDetail = (idx: number, field: string, value: string | number) => {
    setOrderDetails((prev) => {
      const updated = [...prev]
      const detail = { ...updated[idx], [field]: value }
      if (field === 'itemId' && typeof value === 'string') {
        const item = items.find((i) => i.id === value)
        if (item) {
          detail.itemName = item.itemName
          detail.unitPrice = Number(item.standardPrice)
        }
      }
      detail.supplyAmount = Math.round(detail.quantity * detail.unitPrice)
      detail.taxAmount = calcTax(detail.supplyAmount, detail.itemId, vatIncluded)
      detail.amount = detail.supplyAmount + detail.taxAmount
      updated[idx] = detail
      return updated
    })
  }

  const addDetail = () => {
    setOrderDetails((prev) => [
      ...prev,
      { itemId: '', itemName: '', quantity: 1, unitPrice: 0, supplyAmount: 0, taxAmount: 0, amount: 0 },
    ])
  }

  const removeDetail = (idx: number) => {
    setOrderDetails((prev) => prev.filter((_, i) => i !== idx))
  }

  const totalSupply = orderDetails.reduce((s, d) => s + d.supplyAmount, 0)
  const totalTax = orderDetails.reduce((s, d) => s + d.taxAmount, 0)
  const totalAmount = totalSupply + totalTax

  // Excel handlers
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file, EXCEL_KEY_MAP)
      if (rows.length === 0) {
        toast.error('데이터가 없습니다. 템플릿을 확인해주세요.')
        return
      }
      const errors: string[] = []
      rows.forEach((row, idx) => {
        if (!row.itemCode && !row.itemName) errors.push(`${idx + 2}행: 품목코드 또는 품목명이 필요합니다`)
        if (!row.quantity || Number(row.quantity) <= 0) errors.push(`${idx + 2}행: 수량을 확인해주세요`)
      })
      setExcelErrors(errors)
      setExcelPreview(rows)
      setExcelDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '엑셀 파일 읽기 실패')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTemplateDownload = () => {
    downloadImportTemplate({
      fileName: '오프라인_발주_템플릿',
      sheetName: '발주데이터',
      columns: [
        { header: '거래처코드', key: 'partnerCode', example: 'P001', width: 14 },
        { header: '거래처명', key: 'partnerName', example: '(주)한국식품', width: 20, required: true },
        { header: '사업자번호', key: 'bizNo', example: '123-45-67890', width: 16 },
        { header: '품목코드', key: 'itemCode', example: 'ITM001', width: 14 },
        { header: '품목명', key: 'itemName', example: '유기농 사과', width: 20, required: true },
        { header: '규격', key: 'specification', example: '1kg', width: 12 },
        { header: '단위', key: 'unit', example: 'EA', width: 8 },
        { header: '수량', key: 'quantity', example: '100', width: 10, required: true },
        { header: '단가', key: 'unitPrice', example: '5000', width: 12, required: true },
        { header: '비고', key: 'remark', example: '긴급 배송', width: 16 },
        { header: '발주일', key: 'orderDate', example: '2026-03-15', width: 14 },
        { header: '납기일', key: 'deliveryDate', example: '2026-03-20', width: 14 },
        { header: '부가세', key: 'vatType', example: '포함', width: 10 },
        { header: '바코드', key: 'barcode', example: '8801234567890', width: 16 },
        { header: '발주그룹', key: 'orderGroupNo', example: '1', width: 10 },
      ],
    })
  }

  const handleBulkExcelDownload = async () => {
    const selected = orders.filter((o) => selectedOrders.has(o.id))
    if (selected.length === 0) {
      toast.error('다운로드할 발주를 선택하세요.')
      return
    }
    await exportToExcel({
      fileName: `오프라인_발주목록_${getLocalDateString()}`,
      title: '오프라인 발주 목록',
      columns: [
        { header: '발주번호', accessor: 'orderNo' },
        { header: '발주일', accessor: (r) => formatDate(r.orderDate) },
        { header: '거래처', accessor: (r) => r.partner?.partnerName || '-' },
        { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
        { header: '공급가액', accessor: (r) => Number(r.totalSupply).toLocaleString() },
        { header: '세액', accessor: (r) => Number(r.totalTax).toLocaleString() },
        { header: '합계', accessor: (r) => Number(r.totalAmount).toLocaleString() },
        { header: '비고', accessor: (r) => r.description || '' },
      ],
      data: selected,
    })
    toast.success(`${selected.length}건 엑셀 다운로드 완료`)
  }

  const prevMonth = useCallback(() => {
    if (kpiMonth === 1) {
      setKpiYear(kpiYear - 1)
      setKpiMonth(12)
    } else setKpiMonth(kpiMonth - 1)
  }, [kpiYear, kpiMonth])

  const nextMonth = useCallback(() => {
    if (kpiMonth === 12) {
      setKpiYear(kpiYear + 1)
      setKpiMonth(1)
    } else setKpiMonth(kpiMonth + 1)
  }, [kpiYear, kpiMonth])

  const toggleOrder = useCallback((id: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedOrders.size === orders.length) setSelectedOrders(new Set())
    else setSelectedOrders(new Set(orders.map((o) => o.id)))
  }, [selectedOrders.size, orders])

  const pipelineSteps = [
    { label: '전체 발주', count: stats.total, icon: ShoppingCart, color: 'blue' as const },
    { label: '대기/진행', count: stats.ordered + stats.inProgress, icon: Clock, color: 'amber' as const },
    { label: '출고완료', count: stats.completed, icon: CheckCircle2, color: 'emerald' as const },
  ]

  const colorMap = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      text: 'text-blue-600 dark:text-blue-400',
      ring: 'ring-blue-200 dark:ring-blue-800',
      activeBg: 'bg-blue-100 dark:bg-blue-900',
      activeRing: 'ring-blue-500 dark:ring-blue-400',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-200 dark:ring-amber-800',
      activeBg: 'bg-amber-100 dark:bg-amber-900',
      activeRing: 'ring-amber-500 dark:ring-amber-400',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-200 dark:ring-emerald-800',
      activeBg: 'bg-emerald-100 dark:bg-emerald-900',
      activeRing: 'ring-emerald-500 dark:ring-emerald-400',
    },
  }

  const [activeStep, setActiveStep] = useState<number | null>(null)

  return (
    <ShipperLayoutShell>
      <div className="space-y-6">
        <PageHeader
          title="오프라인 주문관리"
          description="오프라인 발주 등록부터 출고까지 관리합니다"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleTemplateDownload}>
                <Download className="mr-2 h-4 w-4" /> 템플릿
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> 엑셀 업로드
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleExcelUpload}
              />
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> 발주등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>오프라인 발주등록</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Basic info */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className="text-xs font-medium">발주일 *</label>
                        <Input
                          type="date"
                          value={orderDate}
                          onChange={(e) => setOrderDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">납기일</label>
                        <Input
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium">거래처</label>
                        <div className="mt-1">
                          <Input
                            placeholder="거래처 검색..."
                            value={partnerSearch}
                            onChange={(e) => setPartnerSearch(e.target.value)}
                          />
                          {partnerSearch && filteredPartners.length > 0 && (
                            <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-white dark:bg-gray-950">
                              {filteredPartners.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setPartnerId(p.id)
                                    setPartnerSearch(p.partnerName)
                                  }}
                                  className="hover:bg-muted w-full px-3 py-1.5 text-left text-xs"
                                >
                                  {p.partnerName} ({p.partnerCode}) {p.bizNo && `- ${p.bizNo}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* VAT toggle */}
                    <div className="flex items-center gap-2">
                      <Checkbox id="vat" checked={vatIncluded} onCheckedChange={(v) => setVatIncluded(!!v)} />
                      <label htmlFor="vat" className="text-xs">
                        부가세 포함
                      </label>
                    </div>

                    {/* Item lines */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">품목 상세</span>
                        <Button variant="outline" size="sm" onClick={addDetail}>
                          <Plus className="mr-1 h-3 w-3" /> 행 추가
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {orderDetails.map((detail, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 rounded border p-2">
                            <div className="col-span-4">
                              <Select value={detail.itemId} onValueChange={(v) => updateDetail(idx, 'itemId', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="품목 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {items.map((item) => (
                                    <SelectItem key={item.id} value={item.id} className="text-xs">
                                      {item.itemName} ({item.itemCode})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                min={1}
                                value={detail.quantity}
                                onChange={(e) => updateDetail(idx, 'quantity', Number(e.target.value))}
                                placeholder="수량"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-2">
                              <Input
                                type="number"
                                value={detail.unitPrice}
                                onChange={(e) => updateDetail(idx, 'unitPrice', Number(e.target.value))}
                                placeholder="단가"
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="col-span-3 flex items-center text-xs">
                              <span className="tabular-nums">{detail.amount.toLocaleString()}원</span>
                            </div>
                            <div className="col-span-1 flex items-center justify-center">
                              {orderDetails.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeDetail(idx)}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex justify-end gap-4 text-xs">
                        <span>
                          공급가: <b className="tabular-nums">{totalSupply.toLocaleString()}</b>원
                        </span>
                        <span>
                          세액: <b className="tabular-nums">{totalTax.toLocaleString()}</b>원
                        </span>
                        <span>
                          합계: <b className="tabular-nums">{totalAmount.toLocaleString()}</b>원
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium">비고</label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1"
                        rows={2}
                        placeholder="비고 사항"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          resetForm()
                          setCreateOpen(false)
                        }}
                      >
                        취소
                      </Button>
                      <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 등록 중...
                          </>
                        ) : (
                          '발주등록'
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        {/* Month selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border px-2 py-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">
              {kpiYear}년 {kpiMonth}월
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Process Pipeline */}
        <Card className="overflow-hidden border shadow-sm">
          <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-xs font-medium">처리 현황</span>
                {activeStep !== null && (
                  <button
                    onClick={() => setActiveStep(null)}
                    className="text-muted-foreground hover:text-foreground ml-1 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors"
                  >
                    <X className="h-3 w-3" /> 필터 해제
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">이행률</span>
                <Badge
                  variant={
                    stats.fulfillmentRate >= 80 ? 'default' : stats.fulfillmentRate >= 50 ? 'secondary' : 'outline'
                  }
                  className="text-xs tabular-nums"
                >
                  {isLoading ? '...' : `${stats.fulfillmentRate}%`}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto sm:gap-0">
              {pipelineSteps.map((step, idx) => {
                const colors = colorMap[step.color]
                const Icon = step.icon
                const isActive = activeStep === idx
                return (
                  <div key={step.label} className="flex min-w-0 flex-1 items-center">
                    <button
                      type="button"
                      onClick={() => setActiveStep(isActive ? null : idx)}
                      className={`flex min-w-[72px] flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-all sm:min-w-[96px] ${
                        isActive ? 'bg-muted/60 scale-105 shadow-sm' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ring-2 transition-all sm:h-10 sm:w-10 ${
                          isActive
                            ? `${colors.activeBg} ${colors.activeRing} scale-110 shadow-md`
                            : `${colors.bg} ${colors.ring}`
                        }`}
                      >
                        {isLoading ? (
                          <Loader2 className={`h-4 w-4 animate-spin ${colors.text}`} />
                        ) : (
                          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${colors.text}`} />
                        )}
                      </div>
                      <div className="text-center">
                        <p
                          className={`text-[10px] leading-tight font-medium sm:text-xs ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                          {step.label}
                        </p>
                        <p
                          className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${isActive ? 'text-foreground' : ''}`}
                        >
                          {isLoading ? '-' : step.count}
                          <span className="text-muted-foreground text-[10px] font-normal">건</span>
                        </p>
                      </div>
                    </button>
                    {idx < pipelineSteps.length - 1 && (
                      <ArrowRight className="text-muted-foreground/40 mx-0.5 h-4 w-4 shrink-0 sm:mx-1" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4">
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-500 to-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: isLoading ? '0%' : `${stats.fulfillmentRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="gap-0 border-l-4 border-l-blue-500 py-4 shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">전체 발주</p>
                <p className="text-lg font-bold tabular-nums">
                  {isLoading ? '-' : stats.total}
                  <span className="text-muted-foreground text-xs font-normal">건</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 border-l-4 border-l-amber-500 py-4 shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">대기/진행</p>
                <p className="text-lg font-bold tabular-nums">
                  {isLoading ? '-' : stats.ordered + stats.inProgress}
                  <span className="text-muted-foreground text-xs font-normal">건</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 border-l-4 border-l-emerald-500 py-4 shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">완료</p>
                <p className="text-lg font-bold tabular-nums">
                  {isLoading ? '-' : stats.completed}
                  <span className="text-muted-foreground text-xs font-normal">건</span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="gap-0 border-l-4 border-l-violet-500 py-4 shadow-sm">
            <CardContent className="flex items-center gap-3 px-4 py-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
                <TrendingUp className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">총 매출액</p>
                <p className="text-lg font-bold tabular-nums">
                  {isLoading ? '-' : stats.totalAmount.toLocaleString()}
                  <span className="text-muted-foreground text-xs font-normal">원</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="발주번호, 거래처 검색..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {[
              { key: 'all', label: '전체' },
              { key: 'active', label: '진행' },
              { key: 'ORDERED', label: '발주' },
              { key: 'IN_PROGRESS', label: '진행중' },
              { key: 'COMPLETED', label: '완료' },
            ].map((f) => (
              <Badge
                key={f.key}
                variant={statusFilter === f.key ? 'default' : 'outline'}
                className="cursor-pointer px-2.5 py-1 text-xs"
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Order List */}
        <Card className="overflow-hidden border shadow-sm">
          <CardHeader className="border-b px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">발주 목록</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {orders.length}건
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {selectedOrders.size > 0 && (
                  <>
                    <Badge variant="outline" className="text-xs">
                      {selectedOrders.size}건 선택
                    </Badge>
                    <Button variant="outline" size="sm" onClick={handleBulkExcelDownload}>
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> 엑셀
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center py-12 text-sm">
                해당 기간의 발주 데이터가 없습니다
              </div>
            ) : (
              <div className="divide-y">
                <div className="bg-muted/30 flex items-center gap-3 px-4 py-2 sm:px-6">
                  <Checkbox
                    checked={orders.length > 0 && selectedOrders.size === orders.length}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-muted-foreground text-xs font-medium">전체 선택</span>
                </div>
                {orders.map((order) => {
                  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: '' }
                  return (
                    <div
                      key={order.id}
                      className="hover:bg-muted/20 flex items-center gap-3 px-4 py-3 transition-colors sm:px-6"
                    >
                      <Checkbox checked={selectedOrders.has(order.id)} onCheckedChange={() => toggleOrder(order.id)} />
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="text-sm font-medium">{order.orderNo}</span>
                        <Badge className={`text-[10px] ${statusInfo.color}`} variant="secondary">
                          {statusInfo.label}
                        </Badge>
                        {order.partner?.partnerName && (
                          <span className="text-muted-foreground text-xs">{order.partner.partnerName}</span>
                        )}
                        <span className="text-muted-foreground text-xs">{formatDate(order.orderDate)}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {Number(order.totalAmount || 0).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDetailOrder(order)}
                          title="상세보기"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {order.status === 'ORDERED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteTarget(order.id)}
                            title="삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog
          open={!!detailOrder}
          onOpenChange={(open) => {
            if (!open) setDetailOrder(null)
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>발주 상세 - {detailOrder?.orderNo}</DialogTitle>
            </DialogHeader>
            {detailData?.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">발주일:</span> {formatDate(detailData.data.orderDate)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">상태:</span>{' '}
                    {STATUS_MAP[detailData.data.status]?.label || detailData.data.status}
                  </div>
                  <div>
                    <span className="text-muted-foreground">거래처:</span> {detailData.data.partner?.partnerName || '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">합계:</span>{' '}
                    {Number(detailData.data.totalAmount).toLocaleString()}원
                  </div>
                </div>
                {detailData.data.details && detailData.data.details.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">품목 내역</p>
                    <div className="divide-y rounded border text-xs">
                      <div className="bg-muted/50 grid grid-cols-6 gap-2 px-3 py-2 font-medium">
                        <span className="col-span-2">품목명</span>
                        <span>수량</span>
                        <span>단가</span>
                        <span>공급가</span>
                        <span>합계</span>
                      </div>
                      {detailData.data.details.map((d) => (
                        <div key={d.id} className="grid grid-cols-6 gap-2 px-3 py-2">
                          <span className="col-span-2">{d.item?.itemName || '-'}</span>
                          <span className="tabular-nums">{d.quantity}</span>
                          <span className="tabular-nums">{Number(d.unitPrice).toLocaleString()}</span>
                          <span className="tabular-nums">{Number(d.supplyAmount).toLocaleString()}</span>
                          <span className="tabular-nums">{Number(d.totalAmount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detailData.data.description && (
                  <div>
                    <p className="text-muted-foreground text-xs">비고</p>
                    <p className="text-sm">{detailData.data.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null)
          }}
          title="발주 삭제"
          description="이 발주를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다."
          confirmLabel="삭제"
          variant="destructive"
          onConfirm={() => {
            if (deleteTarget) deleteMutation.mutate(deleteTarget)
          }}
          isPending={deleteMutation.isPending}
        />

        {/* Excel Preview Dialog */}
        <Dialog open={excelDialogOpen} onOpenChange={setExcelDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>엑셀 데이터 미리보기</DialogTitle>
            </DialogHeader>
            {excelErrors.length > 0 && (
              <div className="rounded border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <p className="mb-1 text-xs font-medium text-red-800 dark:text-red-300">검증 오류:</p>
                {excelErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400">
                    {err}
                  </p>
                ))}
              </div>
            )}
            {excelPreview && (
              <div className="max-h-64 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">#</th>
                      <th className="px-2 py-1.5 text-left">품목명</th>
                      <th className="px-2 py-1.5 text-left">수량</th>
                      <th className="px-2 py-1.5 text-left">단가</th>
                      <th className="px-2 py-1.5 text-left">거래처</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {excelPreview.map((row, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">{i + 1}</td>
                        <td className="px-2 py-1">{String(row.itemName || row.itemCode || '-')}</td>
                        <td className="px-2 py-1 tabular-nums">{String(row.quantity || '-')}</td>
                        <td className="px-2 py-1 tabular-nums">{String(row.unitPrice || '-')}</td>
                        <td className="px-2 py-1">{String(row.partnerName || row.partnerCode || '-')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setExcelPreview(null)
                  setExcelDialogOpen(false)
                }}
              >
                취소
              </Button>
              <Button
                onClick={() => excelPreview && excelImportMutation.mutate(excelPreview)}
                disabled={excelImportMutation.isPending || excelErrors.length > 0}
              >
                {excelImportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 업로드 중...
                  </>
                ) : (
                  `${excelPreview?.length || 0}건 등록`
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ShipperLayoutShell>
  )
}
