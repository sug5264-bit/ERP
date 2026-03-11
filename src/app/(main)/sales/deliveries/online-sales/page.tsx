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
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate, getLocalDateString } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Plus, FileSpreadsheet, FileText, Download, Calendar, TrendingUp, Search } from 'lucide-react'
import { DateRangeFilter } from '@/components/common/date-range-filter'

const CHANNEL_MAP: Record<string, string> = {
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

interface RevenueRow {
  id: string
  revenueDate: string
  channel: string
  description?: string
  totalSales: number
  totalFee: number
  netRevenue: number
  orderCount: number
  memo?: string
  createdAt: string
}

export default function OnlineSalesPage() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [channelFilter, setChannelFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const queryParamsStr = useMemo(() => {
    const qp = new URLSearchParams({ pageSize: '100' })
    if (channelFilter && channelFilter !== 'all') qp.set('channel', channelFilter)
    if (startDate) qp.set('startDate', startDate)
    if (endDate) qp.set('endDate', endDate)
    return qp.toString()
  }, [channelFilter, startDate, endDate])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['online-revenue', channelFilter, startDate, endDate],
    queryFn: () => api.get(`/sales/online-revenue?${queryParamsStr}`) as Promise<{ data: RevenueRow[] }>,
  })

  const revenues = useMemo(() => (data?.data || []) as RevenueRow[], [data?.data])

  const filteredRevenues = useMemo(() => {
    if (!searchTerm) return revenues
    const term = searchTerm.toLowerCase()
    return revenues.filter(
      (r) =>
        (CHANNEL_MAP[r.channel] || r.channel).toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term) ||
        r.memo?.toLowerCase().includes(term)
    )
  }, [revenues, searchTerm])

  // Summary
  const totalSales = filteredRevenues.reduce((s, r) => s + Number(r.totalSales || 0), 0)
  const totalFees = filteredRevenues.reduce((s, r) => s + Number(r.totalFee || 0), 0)
  const totalNet = filteredRevenues.reduce((s, r) => s + Number(r.netRevenue || 0), 0)
  const totalOrders = filteredRevenues.reduce((s, r) => s + Number(r.orderCount || 0), 0)

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/sales/online-revenue', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-revenue'] })
      setOpen(false)
      toast.success('매출이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const totalSalesVal = parseInt(form.get('totalSales') as string, 10) || 0
    const totalFeeVal = parseInt(form.get('totalFee') as string, 10) || 0
    createMutation.mutate({
      revenueDate: form.get('revenueDate'),
      channel: form.get('channel'),
      description: form.get('description') || undefined,
      totalSales: totalSalesVal,
      totalFee: totalFeeVal,
      orderCount: parseInt(form.get('orderCount') as string, 10) || 0,
      memo: form.get('memo') || undefined,
    })
  }

  const exportColumns: ExportColumn[] = [
    { header: '매출일', accessor: (r) => formatDate(r.revenueDate) },
    { header: '판매채널', accessor: (r) => CHANNEL_MAP[r.channel] || r.channel },
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

  return (
    <div className="space-y-6">
      <PageHeader title="매출" description="채널별 매출을 등록하고 관리합니다." />

      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onDateChange={(s, e) => {
          setStartDate(s)
          setEndDate(e)
        }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">등록 건수</p>
          <p className="text-sm font-bold sm:text-lg">
            {filteredRevenues.length}
            <span className="text-muted-foreground ml-0.5 text-xs font-normal">건</span>
          </p>
        </div>
        <div className="bg-status-info-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">총 매출</p>
          <p className="text-status-info text-sm font-bold sm:text-lg">{formatCurrency(totalSales)}</p>
        </div>
        <div className="bg-status-danger-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">수수료</p>
          <p className="text-status-danger text-sm font-bold sm:text-lg">{formatCurrency(totalFees)}</p>
        </div>
        <div className="bg-status-success-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">순매출</p>
          <p className="text-status-success text-sm font-bold sm:text-lg">{formatCurrency(totalNet)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="채널, 설명, 메모로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="전체 채널" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 채널</SelectItem>
            {Object.entries(CHANNEL_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
            <FileText className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> 매출 등록
          </Button>
        </div>
      </div>

      {/* Post list */}
      <div className="space-y-3">
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
        {filteredRevenues.map((row) => (
          <Card key={row.id} className="transition-shadow hover:shadow-md">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left: title / description */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{CHANNEL_MAP[row.channel] || row.channel}</Badge>
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      {formatDate(row.revenueDate)}
                    </span>
                    {row.orderCount > 0 && <span className="text-muted-foreground text-xs">{row.orderCount}건</span>}
                  </div>
                  {row.description && <p className="text-sm">{row.description}</p>}
                  {row.memo && <p className="text-muted-foreground line-clamp-2 text-xs">{row.memo}</p>}
                </div>

                {/* Right: amounts */}
                <div className="flex shrink-0 items-center gap-4 sm:gap-6">
                  <div className="text-right">
                    <p className="text-muted-foreground text-[10px] sm:text-xs">매출</p>
                    <p className="text-sm font-medium sm:text-base">{formatCurrency(Number(row.totalSales))}</p>
                  </div>
                  {Number(row.totalFee) > 0 && (
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] sm:text-xs">수수료</p>
                      <p className="text-status-danger text-sm sm:text-base">-{formatCurrency(Number(row.totalFee))}</p>
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-muted-foreground text-[10px] sm:text-xs">순매출</p>
                    <p className="text-status-success text-sm font-bold sm:text-base">
                      {formatCurrency(Number(row.netRevenue))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Attachments preview row (xlsx/pdf style) */}
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <Download className="text-muted-foreground h-3.5 w-3.5" />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                  onClick={() => {
                    exportToExcel({
                      fileName: `매출_${row.channel}_${row.revenueDate}`,
                      title: `${CHANNEL_MAP[row.channel] || row.channel} 매출`,
                      columns: exportColumns,
                      data: [row],
                    })
                  }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  매출_{row.channel}_{row.revenueDate}.xlsx
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                  onClick={() => {
                    exportToPDF({
                      fileName: `매출_${row.channel}_${row.revenueDate}`,
                      title: `${CHANNEL_MAP[row.channel] || row.channel} 매출`,
                      columns: exportColumns,
                      data: [row],
                    })
                  }}
                >
                  <FileText className="h-3.5 w-3.5 text-red-500" />
                  매출_{row.channel}_{row.revenueDate}.pdf
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>매출 등록</DialogTitle>
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
            </p>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  매출일 <span className="text-destructive">*</span>
                </Label>
                <Input name="revenueDate" type="date" required defaultValue={getLocalDateString()} />
              </div>
              <div className="space-y-2">
                <Label>
                  판매채널 <span className="text-destructive">*</span>
                </Label>
                <Select name="channel" required>
                  <SelectTrigger>
                    <SelectValue placeholder="채널 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CHANNEL_MAP).map(([k, v]) => (
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
              <Input name="description" placeholder="예: 3월 1주차 쿠팡 매출" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>
                  총매출 <span className="text-destructive">*</span>
                </Label>
                <Input name="totalSales" type="number" required placeholder="0" min={0} />
              </div>
              <div className="space-y-2">
                <Label>수수료</Label>
                <Input name="totalFee" type="number" placeholder="0" min={0} />
              </div>
              <div className="space-y-2">
                <Label>주문건수</Label>
                <Input name="orderCount" type="number" placeholder="0" min={0} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea name="memo" placeholder="메모 (선택)" rows={2} />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '매출 등록'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
