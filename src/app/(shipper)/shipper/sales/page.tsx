'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { DateRangeFilter } from '@/components/common/date-range-filter'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDate, formatCurrency } from '@/lib/format'
import { Plus, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'

// ─── Types ───

interface SalesRecord {
  id: string
  salesDate: string
  salesChannel: string | null
  customerName: string | null
  itemName: string
  quantity: number
  unitPrice: string
  totalAmount: string
  memo: string | null
  createdAt: string
}

// ─── Sales Channel Badge Colors ───

const CHANNEL_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  쿠팡: 'destructive',
  네이버: 'default',
  자사몰: 'secondary',
  '11번가': 'outline',
}

function getChannelVariant(channel: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!channel) return 'outline'
  return CHANNEL_COLORS[channel] || 'outline'
}

// ─── Columns ───

const columns: ColumnDef<SalesRecord>[] = [
  {
    accessorKey: 'salesDate',
    header: '매출일',
    cell: ({ row }) => formatDate(row.getValue('salesDate')),
  },
  {
    accessorKey: 'salesChannel',
    header: '판매채널',
    cell: ({ row }) => {
      const channel = row.getValue('salesChannel') as string | null
      if (!channel) return '-'
      return <Badge variant={getChannelVariant(channel)}>{channel}</Badge>
    },
  },
  {
    accessorKey: 'customerName',
    header: '고객명',
    cell: ({ row }) => row.getValue('customerName') || '-',
  },
  { accessorKey: 'itemName', header: '상품명' },
  {
    accessorKey: 'quantity',
    header: '수량',
    cell: ({ row }) => <span className="tabular-nums">{row.getValue('quantity')}</span>,
  },
  {
    accessorKey: 'unitPrice',
    header: '단가',
    cell: ({ row }) => formatCurrency(row.getValue('unitPrice')),
  },
  {
    accessorKey: 'totalAmount',
    header: '합계',
    cell: ({ row }) => <span className="font-bold tabular-nums">{formatCurrency(row.getValue('totalAmount'))}</span>,
  },
]

// ─── Form defaults ───

const INITIAL_FORM = {
  salesDate: new Date().toISOString().slice(0, 10),
  salesChannel: '',
  customerName: '',
  itemName: '',
  quantity: '1',
  unitPrice: '',
  totalAmount: '',
  memo: '',
}

export default function ShipperSalesPage() {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  // ─── Sales Query ───
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shipper-sales', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      const res = await fetch(`/api/v1/shipper/sales?${params.toString()}`)
      return res.json()
    },
  })

  const sales = (data?.data || []) as SalesRecord[]

  // ─── Summary Stats ───
  const stats = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const thisMonthSales = sales.filter((s) => {
      const d = new Date(s.salesDate)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })

    const thisMonthTotal = thisMonthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const thisMonthCount = thisMonthSales.length

    // 월 평균: 전체 매출 합계 / 고유 월 수 (최소 1)
    const totalAll = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const uniqueMonths = new Set(
      sales.map((s) => {
        const d = new Date(s.salesDate)
        return `${d.getFullYear()}-${d.getMonth()}`
      })
    )
    const avgMonthly = uniqueMonths.size > 0 ? totalAll / uniqueMonths.size : 0

    return { thisMonthTotal, thisMonthCount, avgMonthly }
  }, [sales])

  // ─── Create Sale Mutation ───
  const createSale = useMutation({
    mutationFn: async (data: typeof INITIAL_FORM) => {
      const res = await fetch('/api/v1/shipper/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesDate: data.salesDate,
          salesChannel: data.salesChannel || null,
          customerName: data.customerName || null,
          itemName: data.itemName,
          quantity: Number(data.quantity),
          unitPrice: Number(data.unitPrice),
          totalAmount: Number(data.totalAmount),
          memo: data.memo || null,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || '매출 등록에 실패했습니다.')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-sales'] })
      setForm(INITIAL_FORM)
      setDialogOpen(false)
    },
  })

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      // Auto-calculate totalAmount when quantity or unitPrice changes
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : next.quantity) || 0
        const price = Number(field === 'unitPrice' ? value : next.unitPrice) || 0
        next.totalAmount = String(qty * price)
      }
      return next
    })
  }

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="매출현황"
          description="매출 데이터를 확인하고 수기로 등록하세요"
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> 매출 등록
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>매출 수기 등록</DialogTitle>
                  <DialogDescription>매출 정보를 입력하세요.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="salesDate">매출일 *</Label>
                      <Input
                        id="salesDate"
                        type="date"
                        value={form.salesDate}
                        onChange={(e) => handleFormChange('salesDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salesChannel">판매채널</Label>
                      <Input
                        id="salesChannel"
                        value={form.salesChannel}
                        onChange={(e) => handleFormChange('salesChannel', e.target.value)}
                        placeholder="예: 쿠팡, 네이버"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">고객명</Label>
                      <Input
                        id="customerName"
                        value={form.customerName}
                        onChange={(e) => handleFormChange('customerName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="itemName">상품명 *</Label>
                      <Input
                        id="itemName"
                        value={form.itemName}
                        onChange={(e) => handleFormChange('itemName', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">수량 *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={(e) => handleFormChange('quantity', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unitPrice">단가 *</Label>
                      <Input
                        id="unitPrice"
                        type="number"
                        value={form.unitPrice}
                        onChange={(e) => handleFormChange('unitPrice', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="totalAmount">합계</Label>
                      <Input id="totalAmount" type="number" value={form.totalAmount} readOnly className="bg-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memo">메모</Label>
                    <Input id="memo" value={form.memo} onChange={(e) => handleFormChange('memo', e.target.value)} />
                  </div>
                </div>
                {createSale.isError && (
                  <p className="text-destructive text-sm">
                    {createSale.error instanceof Error ? createSale.error.message : '오류가 발생했습니다.'}
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    취소
                  </Button>
                  <Button
                    onClick={() => createSale.mutate(form)}
                    disabled={
                      createSale.isPending ||
                      !form.salesDate ||
                      !form.itemName ||
                      !form.unitPrice ||
                      Number(form.quantity) <= 0
                    }
                  >
                    {createSale.isPending ? '등록 중...' : '등록'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번달 매출</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">이번달 주문건수</CardTitle>
              <ShoppingCart className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonthCount}건</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">월 평균 매출</CardTitle>
              <TrendingUp className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.avgMonthly)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={(s, e) => {
              setStartDate(s)
              setEndDate(e)
            }}
          />
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={sales}
          searchPlaceholder="상품명, 고객명 검색..."
          searchColumn="itemName"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
        />
      </div>
    </ShipperLayoutShell>
  )
}
