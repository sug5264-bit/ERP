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

interface BalanceRow {
  id: string; quantity: number; averageCost: number; orderedQty: number; availableQty: number
  item: { id: string; itemCode: string; itemName: string; unit: string; itemType: string; category: { name: string } | null }
  warehouse: { id: string; code: string; name: string }
  zone: { zoneCode: string; zoneName: string } | null
}

const ITEM_TYPE_MAP: Record<string, string> = {
  RAW_MATERIAL: '원자재', PRODUCT: '제품', GOODS: '상품', SUBSIDIARY: '부자재',
}

export default function StockStatusPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('')

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

  const balances: BalanceRow[] = data?.data || []
  const warehouses = warehousesData?.data || []

  const totalItems = new Set(balances.map((b) => b.item.id)).size
  const totalCurrentQty = balances.reduce((s, b) => s + Number(b.quantity), 0)
  const totalAvailableQty = balances.reduce((s, b) => s + Number(b.availableQty), 0)
  const totalValue = balances.reduce((s, b) => s + Number(b.quantity) * Number(b.averageCost), 0)

  return (
    <div className="space-y-6">
      <PageHeader title="재고현황" description="현재 재고 상태를 조회합니다" />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">품목수</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalItems}종</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">총 현재고</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{totalCurrentQty.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">총 가용재고</CardTitle></CardHeader><CardContent><p className={`text-xl font-bold ${totalAvailableQty < totalCurrentQty ? 'text-orange-600' : ''}`}>{totalAvailableQty.toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">총재고가치</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(totalValue)}</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="전체 창고" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 창고</SelectItem>
            {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">로딩 중...</p>
      ) : balances.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">재고 데이터가 없습니다.</div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">품목코드</th>
                <th className="p-3 text-left">품목명</th>
                <th className="p-3 text-left">구분</th>
                <th className="p-3 text-left">창고</th>
                <th className="p-3 text-left">구역</th>
                <th className="p-3 text-right">현재고</th>
                <th className="p-3 text-right">수주잔량</th>
                <th className="p-3 text-right">가용재고</th>
                <th className="p-3 text-right">평균단가</th>
                <th className="p-3 text-right">재고가치</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const currentQty = Number(b.quantity)
                const orderedQty = Number(b.orderedQty)
                const availableQty = Number(b.availableQty)
                const isShort = availableQty < currentQty
                return (
                  <tr key={b.id} className="border-b">
                    <td className="p-3 font-mono text-xs">{b.item.itemCode}</td>
                    <td className="p-3 font-medium">{b.item.itemName}</td>
                    <td className="p-3"><Badge variant="outline">{ITEM_TYPE_MAP[b.item.itemType] || b.item.itemType}</Badge></td>
                    <td className="p-3">{b.warehouse.name}</td>
                    <td className="p-3">{b.zone?.zoneName || '-'}</td>
                    <td className="p-3 text-right font-mono">{currentQty.toLocaleString()} {b.item.unit}</td>
                    <td className="p-3 text-right font-mono text-orange-600">{orderedQty > 0 ? `-${orderedQty.toLocaleString()}` : '-'}</td>
                    <td className={`p-3 text-right font-mono font-medium ${isShort ? 'text-orange-600' : ''}`}>
                      {availableQty.toLocaleString()} {b.item.unit}
                    </td>
                    <td className="p-3 text-right font-mono">{formatCurrency(b.averageCost)}</td>
                    <td className="p-3 text-right font-mono font-medium">{formatCurrency(currentQty * Number(b.averageCost))}</td>
                  </tr>
                )
              })}
              <tr className="bg-muted/50 font-medium">
                <td className="p-3" colSpan={5}>합계</td>
                <td className="p-3 text-right font-mono">{totalCurrentQty.toLocaleString()}</td>
                <td className="p-3"></td>
                <td className="p-3 text-right font-mono font-bold">{totalAvailableQty.toLocaleString()}</td>
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
