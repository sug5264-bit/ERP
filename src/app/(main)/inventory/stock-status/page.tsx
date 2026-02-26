'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarView, type CalendarEvent } from '@/components/common/calendar-view'
import { formatCurrency, formatDate } from '@/lib/format'
import { Package, Warehouse, TrendingDown, Banknote, CalendarDays, Table2 } from 'lucide-react'

interface BalanceRow {
  id: string
  quantity: number
  averageCost: number
  orderedQty: number
  availableQty: number
  item: {
    id: string
    itemCode: string
    itemName: string
    unit: string
    itemType: string
    category: { name: string } | null
  }
  warehouse: { id: string; code: string; name: string }
  zone: { zoneCode: string; zoneName: string } | null
}

const ITEM_TYPE_MAP: Record<string, string> = {
  RAW_MATERIAL: '원자재',
  PRODUCT: '제품',
  GOODS: '상품',
  SUBSIDIARY: '부자재',
}

const MOVEMENT_VARIANT: Record<string, CalendarEvent['variant']> = {
  INBOUND: 'success',
  OUTBOUND: 'danger',
  TRANSFER: 'info',
  ADJUSTMENT: 'warning',
}

const MOVEMENT_LABEL: Record<string, string> = {
  INBOUND: '입고',
  OUTBOUND: '출고',
  TRANSFER: '이동',
  ADJUSTMENT: '조정',
}

export default function StockStatusPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [selectedDate, setSelectedDate] = useState<{ date: string; events: CalendarEvent[] } | null>(null)

  const qp = new URLSearchParams()
  if (warehouseFilter && warehouseFilter !== 'all') qp.set('warehouseId', warehouseFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-stock-balance', warehouseFilter],
    queryFn: () => api.get(`/inventory/stock-balance?${qp.toString()}`) as Promise<any>,
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: () => api.get('/inventory/warehouses') as Promise<any>,
  })

  // Fetch stock movements for calendar view
  const { data: movementsData } = useQuery({
    queryKey: ['inventory-stock-movement-calendar'],
    queryFn: () => api.get('/inventory/stock-movement?pageSize=200') as Promise<any>,
    enabled: viewMode === 'calendar',
  })

  const balances: BalanceRow[] = data?.data || []
  const warehouses = warehousesData?.data || []

  const totalItems = new Set(balances.map((b) => b.item.id)).size
  const totalCurrentQty = balances.reduce((s, b) => s + Number(b.quantity), 0)
  const totalAvailableQty = balances.reduce((s, b) => s + Number(b.availableQty), 0)
  const totalValue = balances.reduce((s, b) => s + Number(b.quantity) * Number(b.averageCost), 0)

  // Build calendar events from stock movements
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const movements = movementsData?.data || []
    return movements.map((m: any) => ({
      id: m.id,
      date: m.movementDate?.split('T')[0] || '',
      label: `${MOVEMENT_LABEL[m.movementType] || m.movementType} ${m.movementNo}`,
      sublabel: `${m.details?.length || 0}건`,
      variant: MOVEMENT_VARIANT[m.movementType] || 'default',
    }))
  }, [movementsData])

  return (
    <div className="space-y-6">
      <PageHeader title="재고현황" description="현재 재고 상태를 조회합니다" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-xs sm:text-sm">품목수</CardTitle>
            <div className="bg-muted rounded-md p-1.5">
              <Package className="text-muted-foreground h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-xl">
              {totalItems}
              <span className="text-muted-foreground ml-0.5 text-xs font-normal">종</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-xs sm:text-sm">총 현재고</CardTitle>
            <div className="bg-status-info-muted rounded-md p-1.5">
              <Warehouse className="text-status-info h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-status-info text-lg font-bold sm:text-xl">{totalCurrentQty.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-xs sm:text-sm">총 가용재고</CardTitle>
            <div
              className={`rounded-md p-1.5 ${totalAvailableQty < totalCurrentQty ? 'bg-status-warning-muted' : 'bg-status-success-muted'}`}
            >
              <TrendingDown
                className={`h-4 w-4 ${totalAvailableQty < totalCurrentQty ? 'text-status-warning' : 'text-status-success'}`}
              />
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-lg font-bold sm:text-xl ${totalAvailableQty < totalCurrentQty ? 'text-status-warning' : 'text-status-success'}`}
            >
              {totalAvailableQty.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-xs sm:text-sm">총재고가치</CardTitle>
            <div className="bg-muted rounded-md p-1.5">
              <Banknote className="text-muted-foreground h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold sm:text-xl">{formatCurrency(totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="전체 창고" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 창고</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
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

      {viewMode === 'table' ? (
        /* Table view */
        isLoading ? (
          <div className="text-muted-foreground rounded-lg border p-8 text-center">로딩 중...</div>
        ) : balances.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border p-8 text-center">재고 데이터가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-3 text-left font-medium">품목코드</th>
                  <th className="p-3 text-left font-medium">품목명</th>
                  <th className="p-3 text-left font-medium">구분</th>
                  <th className="p-3 text-left font-medium">창고</th>
                  <th className="p-3 text-left font-medium">구역</th>
                  <th className="p-3 text-right font-medium">현재고</th>
                  <th className="p-3 text-right font-medium">수주잔량</th>
                  <th className="p-3 text-right font-medium">가용재고</th>
                  <th className="p-3 text-right font-medium">평균단가</th>
                  <th className="p-3 text-right font-medium">재고가치</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const currentQty = Number(b.quantity)
                  const orderedQty = Number(b.orderedQty)
                  const availableQty = Number(b.availableQty)
                  const isShort = availableQty < currentQty
                  return (
                    <tr key={b.id} className="hover:bg-muted/30 border-b transition-colors">
                      <td className="p-3 font-mono text-xs">{b.item.itemCode}</td>
                      <td className="p-3 font-medium">{b.item.itemName}</td>
                      <td className="p-3">
                        <Badge variant="outline">{ITEM_TYPE_MAP[b.item.itemType] || b.item.itemType}</Badge>
                      </td>
                      <td className="p-3">{b.warehouse.name}</td>
                      <td className="p-3">{b.zone?.zoneName || '-'}</td>
                      <td className="p-3 text-right font-mono">
                        {currentQty.toLocaleString()}{' '}
                        <span className="text-muted-foreground text-xs">{b.item.unit}</span>
                      </td>
                      <td className="text-status-warning p-3 text-right font-mono">
                        {orderedQty > 0 ? `-${orderedQty.toLocaleString()}` : '-'}
                      </td>
                      <td className={`p-3 text-right font-mono font-medium ${isShort ? 'text-status-warning' : ''}`}>
                        {availableQty.toLocaleString()}{' '}
                        <span className="text-muted-foreground text-xs">{b.item.unit}</span>
                      </td>
                      <td className="p-3 text-right font-mono">{formatCurrency(b.averageCost)}</td>
                      <td className="p-3 text-right font-mono font-medium">
                        {formatCurrency(currentQty * Number(b.averageCost))}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-muted/50 font-medium">
                  <td className="p-3" colSpan={5}>
                    합계
                  </td>
                  <td className="p-3 text-right font-mono">{totalCurrentQty.toLocaleString()}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right font-mono font-bold">{totalAvailableQty.toLocaleString()}</td>
                  <td className="p-3"></td>
                  <td className="p-3 text-right font-mono font-bold">{formatCurrency(totalValue)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Calendar view - shows stock movements by date */
        <CalendarView
          events={calendarEvents}
          onDateClick={(date, events) => setSelectedDate({ date, events })}
          maxEventsPerCell={3}
        />
      )}

      {/* Date detail dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(v) => !v && setSelectedDate(null)}>
        <DialogContent className="max-h-[80vh] max-w-sm overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedDate?.date} 입출고 내역</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedDate?.events.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      evt.variant === 'success' ? 'default' : evt.variant === 'danger' ? 'destructive' : 'secondary'
                    }
                  >
                    {evt.label.split(' ')[0]}
                  </Badge>
                  <span className="font-mono text-xs">{evt.label.split(' ').slice(1).join(' ')}</span>
                </div>
                <span className="text-muted-foreground text-xs">{evt.sublabel}</span>
              </div>
            ))}
            {(!selectedDate?.events || selectedDate.events.length === 0) && (
              <p className="text-muted-foreground py-4 text-center text-sm">해당 일자의 데이터가 없습니다.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
