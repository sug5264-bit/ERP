'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { AlertTriangle } from 'lucide-react'

interface BalanceRow {
  id: string; quantity: number; averageCost: number
  item: { id: string; itemCode: string; itemName: string; unit: string; safetyStock: number; itemType: string; category: { name: string } | null }
  warehouse: { id: string; code: string; name: string }
  zone: { zoneCode: string; zoneName: string } | null
}

const ITEM_TYPE_MAP: Record<string, string> = {
  RAW_MATERIAL: '원자재', PRODUCT: '제품', GOODS: '상품', SUBSIDIARY: '부자재',
}

export default function StockStatusPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [showBelowSafety, setShowBelowSafety] = useState(false)

  const qp = new URLSearchParams()
  if (warehouseFilter && warehouseFilter !== 'all') qp.set('warehouseId', warehouseFilter)
  if (showBelowSafety) qp.set('belowSafety', 'true')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-stock-balance', warehouseFilter, showBelowSafety],
    queryFn: () => api.get(`/inventory/stock-balance?${qp.toString()}`) as Promise<any>,
  })

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses'],
    queryFn: () => api.get('/inventory/warehouses') as Promise<any>,
  })

  const balances: BalanceRow[] = data?.data || []
  const warehouses = warehousesData?.data || []

  const totalItems = new Set(balances.map((b) => b.item.id)).size
  const totalQty = balances.reduce((s, b) => s + Number(b.quantity), 0)
  const totalValue = balances.reduce((s, b) => s + Number(b.quantity) * Number(b.averageCost), 0)
  const belowSafetyCount = balances.filter(
    (b) => Number(b.quantity) < b.item.safetyStock && b.item.safetyStock > 0
  ).length

  return (
    <div className="space-y-6">
      <PageHeader title="재고현황" description="현재 재고 상태를 조회합니다" />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">품목수</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalItems}종</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">총수량</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalQty.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">총재고가치</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(totalValue)}</p></CardContent></Card>
        <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setShowBelowSafety(!showBelowSafety)}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> 안전재고 미달</CardTitle></CardHeader>
          <CardContent><p className={`text-xl font-bold ${belowSafetyCount > 0 ? 'text-destructive' : ''}`}>{belowSafetyCount}건</p></CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="전체 창고" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 창고</SelectItem>
            {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {showBelowSafety && (
          <Badge variant="destructive" className="cursor-pointer" onClick={() => setShowBelowSafety(false)}>
            안전재고 미달만 표시 ✕
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">로딩 중...</p>
      ) : balances.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">재고 데이터가 없습니다.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">품목코드</th>
                <th className="p-3 text-left">품목명</th>
                <th className="p-3 text-left">구분</th>
                <th className="p-3 text-left">창고</th>
                <th className="p-3 text-left">구역</th>
                <th className="p-3 text-right">수량</th>
                <th className="p-3 text-right">안전재고</th>
                <th className="p-3 text-right">평균단가</th>
                <th className="p-3 text-right">재고가치</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const isBelowSafety = b.item.safetyStock > 0 && Number(b.quantity) < b.item.safetyStock
                return (
                  <tr key={b.id} className={`border-b ${isBelowSafety ? 'bg-destructive/5' : ''}`}>
                    <td className="p-3 font-mono text-xs">{b.item.itemCode}</td>
                    <td className="p-3 font-medium">{b.item.itemName}</td>
                    <td className="p-3"><Badge variant="outline">{ITEM_TYPE_MAP[b.item.itemType] || b.item.itemType}</Badge></td>
                    <td className="p-3">{b.warehouse.name}</td>
                    <td className="p-3">{b.zone?.zoneName || '-'}</td>
                    <td className="p-3 text-right font-mono">
                      {Number(b.quantity).toLocaleString()} {b.item.unit}
                      {isBelowSafety && <AlertTriangle className="inline ml-1 h-3 w-3 text-destructive" />}
                    </td>
                    <td className="p-3 text-right font-mono">{b.item.safetyStock > 0 ? b.item.safetyStock.toLocaleString() : '-'}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(b.averageCost)}</td>
                    <td className="p-3 text-right font-mono font-medium">{formatCurrency(Number(b.quantity) * Number(b.averageCost))}</td>
                  </tr>
                )
              })}
              <tr className="bg-muted/50 font-medium">
                <td className="p-3" colSpan={5}>합계</td>
                <td className="p-3 text-right font-mono">{totalQty.toLocaleString()}</td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3 text-right font-mono font-bold">{formatCurrency(totalValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
