'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import {
  Plus,
  FileSpreadsheet,
  FileText,
  Search,
  Pencil,
  Trash2,
  Printer,
  ChevronDown,
  ChevronUp,
  Paperclip,
} from 'lucide-react'
import { DateRangeFilter } from '@/components/common/date-range-filter'

const ONLINE_CHANNEL_MAP: Record<string, string> = {
  NAVER: '네이버 스토어',
  COUPANG: '쿠팡',
  GMARKET: 'G마켓',
  AUCTION: '옥션',
  '11ST': '11번가',
  SSG: 'SSG',
  KAKAO: '카카오 선물하기',
  SELF: '자사몰',
  OTHER: '기타',
}

const OFFLINE_CHANNEL_MAP: Record<string, string> = {
  DIRECT: '직접판매',
  WHOLESALE: '도매',
  RETAIL: '소매',
  EXHIBITION: '전시/박람회',
  OTHER_OFFLINE: '기타',
}

const ALL_CHANNEL_MAP: Record<string, string> = { ...ONLINE_CHANNEL_MAP, ...OFFLINE_CHANNEL_MAP }

const SALES_TYPE_MAP: Record<string, string> = {
  ONLINE: '온라인',
  OFFLINE: '오프라인',
}

interface RevenueDetailItem {
  item?: { id: string; itemCode: string; itemName: string; barcode?: string; unit?: string }
  itemId: string
  quantity: number
  unitPrice: number
  amount: number
}

interface RevenueRow {
  id: string
  revenueDate: string
  salesType?: string
  channel: string
  description?: string
  totalSales: number
  totalFee: number
  netRevenue: number
  orderCount: number
  memo?: string
  createdAt: string
  details?: RevenueDetailItem[]
}

interface ItemOption {
  id: string
  itemCode: string
  itemName: string
  barcode?: string
  unit?: string
  standardPrice?: number
}

interface FormItemRow {
  itemId: string
  quantity: number
  unitPrice: number
}

export default function OnlineSalesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RevenueRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RevenueRow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [formSalesType, setFormSalesType] = useState<string>('ONLINE')
  const [formItems, setFormItems] = useState<FormItemRow[]>([])

  // Fetch available items for the item selector
  const { data: itemsData } = useQuery({
    queryKey: ['items-for-revenue'],
    queryFn: () => api.get('/items?pageSize=500&isActive=true') as Promise<{ data: ItemOption[] }>,
    staleTime: 5 * 60 * 1000,
  })
  const itemOptions = useMemo(() => (itemsData?.data || []) as ItemOption[], [itemsData?.data])

  const queryParamsStr = useMemo(() => {
    const qp = new URLSearchParams({ pageSize: '100' })
    if (channelFilter && channelFilter !== 'all') qp.set('channel', channelFilter)
    if (typeFilter && typeFilter !== 'all') qp.set('salesType', typeFilter)
    if (startDate) qp.set('startDate', startDate)
    if (endDate) qp.set('endDate', endDate)
    return qp.toString()
  }, [channelFilter, typeFilter, startDate, endDate])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['online-revenue', channelFilter, typeFilter, startDate, endDate],
    queryFn: () => api.get(`/sales/online-revenue?${queryParamsStr}`) as Promise<{ data: RevenueRow[] }>,
  })

  const revenues = useMemo(() => (data?.data || []) as RevenueRow[], [data?.data])

  const filteredRevenues = useMemo(() => {
    if (!searchTerm) return revenues
    const term = searchTerm.toLowerCase()
    return revenues.filter(
      (r) =>
        (ALL_CHANNEL_MAP[r.channel] || r.channel).toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term) ||
        r.memo?.toLowerCase().includes(term)
    )
  }, [revenues, searchTerm])

  // Summary
  const totalSales = filteredRevenues.reduce((s, r) => s + Number(r.totalSales || 0), 0)
  const totalFees = filteredRevenues.reduce((s, r) => s + Number(r.totalFee || 0), 0)
  const totalNet = filteredRevenues.reduce((s, r) => s + Number(r.netRevenue || 0), 0)

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/online-revenue', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-revenue'] })
      setOpen(false)
      setFormItems([])
      toast.success('매출이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown>) => api.put(`/sales/online-revenue/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-revenue'] })
      setEditTarget(null)
      toast.success('매출이 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sales/online-revenue/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-revenue'] })
      setDeleteTarget(null)
      toast.success('매출이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const validItems = formItems.filter((i) => i.itemId && i.quantity > 0)
    createMutation.mutate({
      revenueDate: form.get('revenueDate'),
      salesType: form.get('salesType'),
      channel: form.get('channel'),
      description: form.get('description') || undefined,
      totalSales: parseInt(form.get('totalSales') as string, 10) || 0,
      totalFee: parseInt(form.get('totalFee') as string, 10) || 0,
      orderCount: parseInt(form.get('orderCount') as string, 10) || 0,
      memo: form.get('memo') || undefined,
      ...(validItems.length > 0 && { items: validItems }),
    })
  }

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      revenueDate: form.get('revenueDate'),
      salesType: form.get('salesType'),
      channel: form.get('channel'),
      description: form.get('description') || undefined,
      totalSales: parseInt(form.get('totalSales') as string, 10) || 0,
      totalFee: parseInt(form.get('totalFee') as string, 10) || 0,
      orderCount: parseInt(form.get('orderCount') as string, 10) || 0,
      memo: form.get('memo') || undefined,
    })
  }

  const openEdit = (row: RevenueRow) => {
    setEditTarget(row)
    setFormSalesType(row.salesType || 'ONLINE')
  }

  const openCreate = () => {
    setFormSalesType('ONLINE')
    setFormItems([])
    setOpen(true)
  }

  const addFormItem = () => {
    setFormItems([...formItems, { itemId: '', quantity: 1, unitPrice: 0 }])
  }

  const updateFormItem = (idx: number, field: keyof FormItemRow, value: string | number) => {
    const updated = [...formItems]
    ;(updated[idx] as unknown as Record<string, string | number>)[field] = value
    setFormItems(updated)
  }

  const removeFormItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx))
  }

  const currentChannelMap = formSalesType === 'OFFLINE' ? OFFLINE_CHANNEL_MAP : ONLINE_CHANNEL_MAP

  const exportColumns: ExportColumn[] = [
    { header: '구분', accessor: (r) => SALES_TYPE_MAP[r.salesType] || '온라인' },
    { header: '매출일', accessor: (r) => formatDate(r.revenueDate) },
    { header: '판매채널', accessor: (r) => ALL_CHANNEL_MAP[r.channel] || r.channel },
    { header: '설명', accessor: (r) => r.description || '' },
    { header: '주문건수', accessor: (r) => `${r.orderCount}건` },
    { header: '총매출', accessor: (r) => formatCurrency(Number(r.totalSales)) },
    { header: '수수료', accessor: (r) => formatCurrency(Number(r.totalFee)) },
    { header: '순매출', accessor: (r) => formatCurrency(Number(r.netRevenue)) },
    { header: '메모', accessor: (r) => r.memo || '' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = {
      fileName: '매출목록',
      title: '매출 목록',
      columns: exportColumns,
      data: filteredRevenues,
    }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const weekdays = ['일', '월', '화', '수', '목', '금', '토']
      const wd = weekdays[d.getDay()]
      const h = String(d.getHours()).padStart(2, '0')
      const min = String(d.getMinutes()).padStart(2, '0')
      return `${y}/${m}/${day} (${wd}) ${h}:${min}`
    } catch {
      return formatDate(dateStr)
    }
  }

  const RevenueForm = ({
    onSubmit,
    defaultValues,
    isPending,
    submitLabel,
  }: {
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    defaultValues?: RevenueRow | null
    isPending: boolean
    submitLabel: string
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>
            매출일 <span className="text-destructive">*</span>
          </Label>
          <Input
            name="revenueDate"
            type="date"
            required
            defaultValue={defaultValues?.revenueDate?.slice(0, 10) || getLocalDateString()}
          />
        </div>
        <div className="space-y-2">
          <Label>
            구분 <span className="text-destructive">*</span>
          </Label>
          <Select name="salesType" required value={formSalesType} onValueChange={(v) => setFormSalesType(v)}>
            <SelectTrigger>
              <SelectValue placeholder="구분 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ONLINE">온라인</SelectItem>
              <SelectItem value="OFFLINE">오프라인</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>
            판매채널 <span className="text-destructive">*</span>
          </Label>
          <Select name="channel" required defaultValue={defaultValues?.channel}>
            <SelectTrigger>
              <SelectValue placeholder="채널 선택" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(currentChannelMap).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>설명</Label>
        <Input
          name="description"
          placeholder="예: 3월 1주차 쿠팡 매출"
          defaultValue={defaultValues?.description || ''}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>
            총매출 <span className="text-destructive">*</span>
          </Label>
          <Input
            name="totalSales"
            type="number"
            required
            placeholder="0"
            min={0}
            defaultValue={defaultValues ? Number(defaultValues.totalSales) : ''}
          />
        </div>
        <div className="space-y-2">
          <Label>수수료</Label>
          <Input
            name="totalFee"
            type="number"
            placeholder="0"
            min={0}
            defaultValue={defaultValues ? Number(defaultValues.totalFee) : ''}
          />
        </div>
        <div className="space-y-2">
          <Label>주문건수</Label>
          <Input
            name="orderCount"
            type="number"
            placeholder="0"
            min={0}
            defaultValue={defaultValues?.orderCount || ''}
          />
        </div>
      </div>
      {/* Items section (for stock deduction) */}
      {!defaultValues && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">품목 내역 (재고 차감)</Label>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addFormItem}>
              <Plus className="mr-1 h-3 w-3" /> 품목 추가
            </Button>
          </div>
          {formItems.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[500px] text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="px-2 py-2 text-left font-medium">품목</th>
                    <th className="px-2 py-2 text-right font-medium">수량</th>
                    <th className="px-2 py-2 text-right font-medium">단가</th>
                    <th className="px-2 py-2 text-right font-medium">금액</th>
                    <th className="w-8 px-1 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map((fi, idx) => (
                    <tr key={idx} className="border-b last:border-b-0">
                      <td className="px-1 py-1.5">
                        <select
                          className="border-input bg-background h-7 w-full min-w-[180px] rounded-md border px-2 text-xs"
                          value={fi.itemId}
                          onChange={(e) => {
                            updateFormItem(idx, 'itemId', e.target.value)
                            const item = itemOptions.find((i) => i.id === e.target.value)
                            if (item?.standardPrice) {
                              updateFormItem(idx, 'unitPrice', Number(item.standardPrice))
                            }
                          }}
                        >
                          <option value="">품목 선택</option>
                          {itemOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.itemName} ({item.itemCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          className="h-7 w-[70px] text-right text-xs"
                          value={fi.quantity || ''}
                          onChange={(e) => updateFormItem(idx, 'quantity', parseInt(e.target.value, 10) || 0)}
                          min={1}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          className="h-7 w-[100px] text-right text-xs"
                          value={fi.unitPrice || ''}
                          onChange={(e) => updateFormItem(idx, 'unitPrice', parseInt(e.target.value, 10) || 0)}
                          min={0}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-medium whitespace-nowrap">
                        {formatCurrency(fi.quantity * fi.unitPrice)}
                      </td>
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeFormItem(idx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {formItems.length === 0 && (
            <p className="text-muted-foreground text-xs">품목을 추가하면 매출 등록 시 재고가 자동으로 차감됩니다.</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>메모</Label>
        <Textarea name="memo" placeholder="메모 (선택)" rows={3} defaultValue={defaultValues?.memo || ''} />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '처리 중...' : submitLabel}
      </Button>
    </form>
  )

  return (
    <div className="space-y-4">
      <PageHeader title="매출수기등록" description="온라인/오프라인 채널별 매출을 수기로 등록하고 관리합니다." />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="전체 구분" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 구분</SelectItem>
            <SelectItem value="ONLINE">온라인</SelectItem>
            <SelectItem value="OFFLINE">오프라인</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="전체 채널" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 채널</SelectItem>
            {Object.entries(ALL_CHANNEL_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="채널, 설명, 메모 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <FileText className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 매출 등록
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-muted/40 flex flex-wrap items-center gap-4 rounded-lg border px-4 py-2 text-xs sm:gap-6 sm:text-sm">
        <span>
          전체 <strong>{filteredRevenues.length}</strong>건
        </span>
        <span>
          총매출 <strong className="text-status-info">{formatCurrency(totalSales)}</strong>
        </span>
        <span>
          수수료 <strong className="text-status-danger">{formatCurrency(totalFees)}</strong>
        </span>
        <span>
          순매출 <strong className="text-status-success">{formatCurrency(totalNet)}</strong>
        </span>
      </div>

      {/* Board-style post list */}
      <div className="overflow-hidden rounded-lg border">
        {/* Board header */}
        <div className="bg-muted/50 hidden grid-cols-[60px_1fr_120px_120px_160px] items-center gap-2 border-b px-4 py-2 text-xs font-medium sm:grid">
          <span>번호</span>
          <span>제목</span>
          <span>채널</span>
          <span className="text-right">순매출</span>
          <span className="text-right">등록일시</span>
        </div>

        {isLoading && <div className="text-muted-foreground py-12 text-center text-sm">불러오는 중...</div>}
        {isError && (
          <div className="py-12 text-center">
            <p className="text-destructive mb-2 text-sm">데이터를 불러오지 못했습니다.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              다시 시도
            </Button>
          </div>
        )}
        {!isLoading && !isError && filteredRevenues.length === 0 && (
          <div className="text-muted-foreground py-12 text-center text-sm">
            {searchTerm ? '검색 결과가 없습니다.' : '등록된 매출이 없습니다.'}
          </div>
        )}

        {filteredRevenues.map((row, idx) => {
          const isExpanded = expandedId === row.id
          const postNo = filteredRevenues.length - idx
          const title =
            row.description || `${ALL_CHANNEL_MAP[row.channel] || row.channel} 매출 (${formatDate(row.revenueDate)})`
          const channelLabel = ALL_CHANNEL_MAP[row.channel] || row.channel
          const typeLabel = SALES_TYPE_MAP[row.salesType || 'ONLINE'] || '온라인'

          return (
            <div key={row.id} className="border-b last:border-b-0">
              {/* Row header (click to expand) */}
              <button
                type="button"
                className="hover:bg-muted/30 flex w-full items-center gap-2 px-4 py-3 text-left transition-colors sm:grid sm:grid-cols-[60px_1fr_120px_120px_160px]"
                onClick={() => setExpandedId(isExpanded ? null : row.id)}
              >
                <span className="text-muted-foreground hidden text-xs sm:block">{postNo}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={row.salesType === 'OFFLINE' ? 'secondary' : 'default'}
                      className="shrink-0 text-[10px]"
                    >
                      {typeLabel}
                    </Badge>
                    <span className="truncate text-sm font-medium">{title}</span>
                    {row.orderCount > 0 && (
                      <span className="text-muted-foreground shrink-0 text-xs">({row.orderCount}건)</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
                    )}
                  </div>
                </div>
                <span className="hidden text-xs sm:block">
                  <Badge variant="outline" className="text-[10px]">
                    {channelLabel}
                  </Badge>
                </span>
                <span className="text-status-success hidden text-right text-sm font-bold sm:block">
                  {formatCurrency(Number(row.netRevenue))}
                </span>
                <span className="text-muted-foreground hidden text-right text-xs sm:block">
                  {formatDateTime(row.createdAt)}
                </span>
              </button>

              {/* Expanded content (post body) */}
              {isExpanded && (
                <div className="border-t bg-white px-4 py-4 sm:pl-[76px] dark:bg-transparent">
                  {/* Attachments */}
                  <div className="mb-3 flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0 pt-0.5 text-xs font-medium">첨부</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-primary flex items-center gap-1 text-xs hover:underline"
                        onClick={() => {
                          exportToExcel({
                            fileName: `매출_${row.channel}_${row.revenueDate}`,
                            title: `${channelLabel} 매출`,
                            columns: exportColumns,
                            data: [row],
                          })
                        }}
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="text-primary">
                          매출_{row.channel}_{row.revenueDate}.xlsx
                        </span>
                        <span className="text-muted-foreground">({(Number(row.totalSales) / 1000).toFixed(1)}KB)</span>
                      </button>
                      <button
                        type="button"
                        className="text-primary flex items-center gap-1 text-xs hover:underline"
                        onClick={() => {
                          exportToPDF({
                            fileName: `매출_${row.channel}_${row.revenueDate}`,
                            title: `${channelLabel} 매출`,
                            columns: exportColumns,
                            data: [row],
                          })
                        }}
                      >
                        <Paperclip className="h-3 w-3" />
                        <span className="text-primary">
                          매출_{row.channel}_{row.revenueDate}.pdf
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Body content */}
                  <div className="mb-4 space-y-2 text-sm leading-relaxed whitespace-pre-wrap">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                      <div>
                        <span className="text-muted-foreground text-xs">매출일</span>
                        <p className="text-sm font-medium">{formatDate(row.revenueDate)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">총매출</span>
                        <p className="text-sm font-medium">{formatCurrency(Number(row.totalSales))}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">수수료</span>
                        <p className="text-status-danger text-sm">-{formatCurrency(Number(row.totalFee))}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">순매출</span>
                        <p className="text-status-success text-sm font-bold">
                          {formatCurrency(Number(row.netRevenue))}
                        </p>
                      </div>
                    </div>
                    {row.details && row.details.length > 0 && (
                      <div className="mt-3">
                        <p className="text-muted-foreground mb-1 text-xs font-medium">품목 내역</p>
                        <div className="overflow-x-auto rounded-md border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="px-2 py-1.5 text-left font-medium">품목명</th>
                                <th className="px-2 py-1.5 text-left font-medium">품목코드</th>
                                <th className="px-2 py-1.5 text-right font-medium">수량</th>
                                <th className="px-2 py-1.5 text-right font-medium">단가</th>
                                <th className="px-2 py-1.5 text-right font-medium">금액</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.details.map((d, dIdx) => (
                                <tr key={dIdx} className="border-b last:border-b-0">
                                  <td className="px-2 py-1.5">{d.item?.itemName || '-'}</td>
                                  <td className="px-2 py-1.5 font-mono">{d.item?.itemCode || '-'}</td>
                                  <td className="px-2 py-1.5 text-right">
                                    {d.quantity} {d.item?.unit || 'EA'}
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
                    {row.memo && <div className="bg-muted/30 mt-3 rounded-md p-3 text-sm">{row.memo}</div>}
                  </div>

                  {/* Action buttons (like 댓글, 수정, 삭제) */}
                  <div className="flex items-center gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(row)}>
                      <Pencil className="h-3 w-3" /> 수정
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 gap-1 text-xs"
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="h-3 w-3" /> 삭제
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        exportToExcel({
                          fileName: `매출_${row.channel}_${row.revenueDate}`,
                          title: `${channelLabel} 매출`,
                          columns: exportColumns,
                          data: [row],
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

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>매출 등록</DialogTitle>
            <DialogDescription>
              <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
            </DialogDescription>
          </DialogHeader>
          <RevenueForm onSubmit={handleCreate} isPending={createMutation.isPending} submitLabel="매출 등록" />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-sm sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>매출 수정</DialogTitle>
            <DialogDescription>매출 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <RevenueForm
              key={editTarget.id}
              onSubmit={handleEdit}
              defaultValues={editTarget}
              isPending={updateMutation.isPending}
              submitLabel="수정 저장"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>매출 삭제</DialogTitle>
            <DialogDescription>정말 이 매출 항목을 삭제하시겠습니까?</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-md p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">채널:</span>{' '}
                  {ALL_CHANNEL_MAP[deleteTarget.channel] || deleteTarget.channel}
                </p>
                <p>
                  <span className="text-muted-foreground">매출일:</span> {formatDate(deleteTarget.revenueDate)}
                </p>
                <p>
                  <span className="text-muted-foreground">총매출:</span>{' '}
                  {formatCurrency(Number(deleteTarget.totalSales))}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                  취소
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? '삭제 중...' : '삭제'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
