'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/format'
import { Plus } from 'lucide-react'

// ─── Types ───

interface ShipperItem {
  id: string
  itemCode: string
  itemName: string
  barcode: string | null
  category: string | null
  weight: string | null
  storageTemp: string
  unitPrice: string | null
  isActive: boolean
  memo: string | null
  createdAt: string
}

interface InventoryRow {
  id: string
  itemCode: string
  itemName: string
  zoneName: string | null
  quantity: number
  lotNo: string | null
  expiryDate: string | null
  inboundDate: string | null
  memo: string | null
}

// ─── Storage Temp Badge ───

const STORAGE_TEMP_MAP: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  AMBIENT: { label: '상온', variant: 'secondary' },
  REFRIGERATED: { label: '냉장', variant: 'default' },
  FROZEN: { label: '냉동', variant: 'destructive' },
}

// ─── Item Columns ───

const itemColumns: ColumnDef<ShipperItem>[] = [
  {
    accessorKey: 'itemCode',
    header: '품목코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('itemCode')}</span>,
  },
  { accessorKey: 'itemName', header: '품목명' },
  {
    accessorKey: 'barcode',
    header: '바코드',
    cell: ({ row }) => row.getValue('barcode') || '-',
  },
  {
    accessorKey: 'category',
    header: '카테고리',
    cell: ({ row }) => row.getValue('category') || '-',
  },
  {
    accessorKey: 'weight',
    header: '중량(kg)',
    cell: ({ row }) => {
      const w = row.getValue('weight') as string | null
      return w ? `${Number(w).toFixed(1)}kg` : '-'
    },
  },
  {
    accessorKey: 'storageTemp',
    header: '보관온도',
    cell: ({ row }) => {
      const temp = row.getValue('storageTemp') as string
      const info = STORAGE_TEMP_MAP[temp] || { label: temp, variant: 'outline' as const }
      return <Badge variant={info.variant}>{info.label}</Badge>
    },
  },
  {
    accessorKey: 'unitPrice',
    header: '단가',
    cell: ({ row }) => {
      const p = row.getValue('unitPrice') as string | null
      return p ? formatCurrency(p) : '-'
    },
  },
]

// ─── Inventory Columns ───

const inventoryColumns: ColumnDef<InventoryRow>[] = [
  {
    accessorKey: 'itemCode',
    header: '품목코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.getValue('itemCode')}</span>,
  },
  { accessorKey: 'itemName', header: '품목명' },
  {
    accessorKey: 'zoneName',
    header: '구역',
    cell: ({ row }) => row.getValue('zoneName') || '-',
  },
  {
    accessorKey: 'quantity',
    header: '수량',
    cell: ({ row }) => <span className="font-semibold tabular-nums">{row.getValue('quantity')}</span>,
  },
  {
    accessorKey: 'lotNo',
    header: 'LOT번호',
    cell: ({ row }) => row.getValue('lotNo') || '-',
  },
  {
    accessorKey: 'expiryDate',
    header: '유통기한',
    cell: ({ row }) => formatDate(row.getValue('expiryDate')),
  },
  {
    accessorKey: 'inboundDate',
    header: '입고일',
    cell: ({ row }) => formatDate(row.getValue('inboundDate')),
  },
]

// ─── Add Item Form defaults ───

const INITIAL_FORM = {
  itemCode: '',
  itemName: '',
  barcode: '',
  category: '',
  weight: '',
  storageTemp: 'AMBIENT',
  unitPrice: '',
  memo: '',
}

export default function ShipperInventoryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  // ─── Items Query ───
  const {
    data: itemsData,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['shipper-items', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/v1/shipper/items?${params.toString()}`)
      return res.json()
    },
  })

  // ─── Inventory Query ───
  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    isError: inventoryError,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ['shipper-inventory', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/v1/shipper/inventory?${params.toString()}`)
      return res.json()
    },
  })

  // ─── Create Item Mutation ───
  const createItem = useMutation({
    mutationFn: async (data: typeof INITIAL_FORM) => {
      const res = await fetch('/api/v1/shipper/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          weight: data.weight ? Number(data.weight) : null,
          unitPrice: data.unitPrice ? Number(data.unitPrice) : null,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message || '품목 등록에 실패했습니다.')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipper-items'] })
      setForm(INITIAL_FORM)
      setDialogOpen(false)
    },
  })

  const items = (itemsData?.data || []) as ShipperItem[]
  const inventory = (inventoryData?.data || []) as InventoryRow[]

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="재고현황" description="품목 관리 및 재고 현황을 확인하세요" />

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="품목명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-64"
          />
        </div>

        <Tabs defaultValue="items" className="w-full">
          <TabsList>
            <TabsTrigger value="items">품목관리</TabsTrigger>
            <TabsTrigger value="inventory">재고현황</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" /> 품목 등록
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>새 품목 등록</DialogTitle>
                    <DialogDescription>화주사 품목 정보를 입력하세요.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="itemCode">품목코드 *</Label>
                        <Input
                          id="itemCode"
                          value={form.itemCode}
                          onChange={(e) => handleFormChange('itemCode', e.target.value)}
                          placeholder="예: SKU-001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="itemName">품목명 *</Label>
                        <Input
                          id="itemName"
                          value={form.itemName}
                          onChange={(e) => handleFormChange('itemName', e.target.value)}
                          placeholder="예: 유기농 사과"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="barcode">바코드</Label>
                        <Input
                          id="barcode"
                          value={form.barcode}
                          onChange={(e) => handleFormChange('barcode', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">카테고리</Label>
                        <Input
                          id="category"
                          value={form.category}
                          onChange={(e) => handleFormChange('category', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="weight">중량(kg)</Label>
                        <Input
                          id="weight"
                          type="number"
                          step="0.1"
                          value={form.weight}
                          onChange={(e) => handleFormChange('weight', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="storageTemp">보관온도</Label>
                        <Select value={form.storageTemp} onValueChange={(v) => handleFormChange('storageTemp', v)}>
                          <SelectTrigger id="storageTemp">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AMBIENT">상온</SelectItem>
                            <SelectItem value="REFRIGERATED">냉장</SelectItem>
                            <SelectItem value="FROZEN">냉동</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unitPrice">단가(원)</Label>
                        <Input
                          id="unitPrice"
                          type="number"
                          value={form.unitPrice}
                          onChange={(e) => handleFormChange('unitPrice', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memo">메모</Label>
                      <Input id="memo" value={form.memo} onChange={(e) => handleFormChange('memo', e.target.value)} />
                    </div>
                  </div>
                  {createItem.isError && (
                    <p className="text-destructive text-sm">
                      {createItem.error instanceof Error ? createItem.error.message : '오류가 발생했습니다.'}
                    </p>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      취소
                    </Button>
                    <Button
                      onClick={() => createItem.mutate(form)}
                      disabled={createItem.isPending || !form.itemCode || !form.itemName}
                    >
                      {createItem.isPending ? '등록 중...' : '등록'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <DataTable
              columns={itemColumns}
              data={items}
              searchPlaceholder="품목코드, 품목명 검색..."
              searchColumn="itemName"
              isLoading={itemsLoading}
              isError={itemsError}
              onRetry={() => refetchItems()}
            />
          </TabsContent>

          <TabsContent value="inventory" className="mt-4">
            <DataTable
              columns={inventoryColumns}
              data={inventory}
              searchPlaceholder="품목명 검색..."
              searchColumn="itemName"
              isLoading={inventoryLoading}
              isError={inventoryError}
              onRetry={() => refetchInventory()}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ShipperLayoutShell>
  )
}
