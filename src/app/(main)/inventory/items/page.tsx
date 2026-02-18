'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { ExcelImportDialog } from '@/components/common/excel-import-dialog'
import type { TemplateColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Upload, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const ITEM_TYPE_MAP: Record<string, string> = {
  RAW_MATERIAL: '원자재', PRODUCT: '제품', GOODS: '상품', SUBSIDIARY: '부자재',
}

const TAX_TYPE_MAP: Record<string, string> = {
  TAXABLE: '과세', TAX_FREE: '면세', ZERO_RATE: '영세',
}

interface ItemRow {
  id: string; itemCode: string; itemName: string; specification: string | null
  unit: string; standardPrice: number; safetyStock: number; itemType: string
  taxType: string; barcode: string | null; isActive: boolean
  category: { code: string; name: string } | null
}

const columns: ColumnDef<ItemRow>[] = [
  { accessorKey: 'itemCode', header: '품목코드', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
  { accessorKey: 'itemName', header: '품목명', cell: ({ row }) => <span className="font-medium">{row.original.itemName}</span> },
  { id: 'itemType', header: '구분', cell: ({ row }) => <Badge variant="outline">{ITEM_TYPE_MAP[row.original.itemType] || row.original.itemType}</Badge> },
  { id: 'taxType', header: '과세', cell: ({ row }) => <Badge variant={row.original.taxType === 'TAX_FREE' ? 'secondary' : row.original.taxType === 'ZERO_RATE' ? 'outline' : 'default'}>{TAX_TYPE_MAP[row.original.taxType] || '과세'}</Badge> },
  { id: 'category', header: '분류', cell: ({ row }) => row.original.category?.name || '-' },
  { accessorKey: 'barcode', header: '바코드', cell: ({ row }) => row.original.barcode ? <span className="font-mono text-xs">{row.original.barcode}</span> : '-' },
  { id: 'specification', header: '규격', cell: ({ row }) => row.original.specification || '-' },
  { id: 'unit', header: '단위', cell: ({ row }) => row.original.unit },
  { id: 'standardPrice', header: '기준가', cell: ({ row }) => formatCurrency(row.original.standardPrice) },
  { id: 'safetyStock', header: '안전재고', cell: ({ row }) => row.original.safetyStock },
  { id: 'status', header: '상태', cell: ({ row }) => <Badge variant={row.original.isActive ? 'default' : 'secondary'}>{row.original.isActive ? '활성' : '비활성'}</Badge> },
]

export default function ItemsPage() {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (typeFilter && typeFilter !== 'all') qp.set('itemType', typeFilter)
  if (search) qp.set('search', search)

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-items', typeFilter, search],
    queryFn: () => api.get(`/inventory/items?${qp.toString()}`) as Promise<any>,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get('/inventory/categories') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/inventory/items', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      setOpen(false)
      toast.success('품목이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/items/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory-items'] }); toast.success('품목이 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name })
  }

  const items: ItemRow[] = data?.data || []
  const categories = categoriesData?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '품목코드', accessor: 'itemCode' },
    { header: '품목명', accessor: 'itemName' },
    { header: '구분', accessor: (r) => ITEM_TYPE_MAP[r.itemType] || r.itemType },
    { header: '과세구분', accessor: (r) => TAX_TYPE_MAP[r.taxType] || '과세' },
    { header: '분류', accessor: (r) => r.category?.name || '' },
    { header: '바코드', accessor: 'barcode' },
    { header: '규격', accessor: 'specification' },
    { header: '단위', accessor: 'unit' },
    { header: '기준가', accessor: 'standardPrice' },
    { header: '안전재고', accessor: 'safetyStock' },
    { header: '상태', accessor: (r) => r.isActive ? '활성' : '비활성' },
  ]

  const importTemplateColumns: TemplateColumn[] = [
    { header: '품목코드', key: 'itemCode', example: 'ITM-001' },
    { header: '품목명', key: 'itemName', example: '테스트 품목' },
    { header: '구분', key: 'itemType', example: '상품' },
    { header: '규격', key: 'specification', example: '100x200mm' },
    { header: '단위', key: 'unit', example: 'EA' },
    { header: '기준가', key: 'standardPrice', example: '10000' },
    { header: '안전재고', key: 'safetyStock', example: '100' },
    { header: '바코드', key: 'barcode', example: '8801234567890' },
  ]

  const importKeyMap: Record<string, string> = {
    '품목코드': 'itemCode', '품목명': 'itemName', '구분': 'itemType',
    '규격': 'specification', '단위': 'unit', '기준가': 'standardPrice',
    '안전재고': 'safetyStock', '바코드': 'barcode',
  }

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '품목목록', title: '품목관리 목록', columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      itemCode: form.get('itemCode'),
      itemName: form.get('itemName'),
      specification: form.get('specification') || undefined,
      categoryId: form.get('categoryId') || undefined,
      unit: form.get('unit') || 'EA',
      standardPrice: parseFloat(form.get('standardPrice') as string) || 0,
      safetyStock: parseInt(form.get('safetyStock') as string) || 0,
      itemType: form.get('itemType') || 'GOODS',
      taxType: form.get('taxType') || 'TAXABLE',
      barcode: form.get('barcode') || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="품목관리" description="상품 및 원자재 품목을 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Input
          placeholder="품목코드, 품목명, 바코드 검색..."
          className="w-full sm:w-72"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="전체 구분" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(ITEM_TYPE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> 업로드
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>품목 등록</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>품목 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>품목코드 *</Label><Input name="itemCode" required placeholder="ITM-001" /></div>
                <div className="space-y-2"><Label>품목명 *</Label><Input name="itemName" required /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>구분 *</Label>
                  <Select name="itemType" defaultValue="GOODS">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ITEM_TYPE_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>과세구분</Label>
                  <Select name="taxType" defaultValue="TAXABLE">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TAX_TYPE_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>분류</Label>
                  <Select name="categoryId">
                    <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>단위</Label><Input name="unit" defaultValue="EA" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>규격</Label><Input name="specification" /></div>
                <div className="space-y-2"><Label>바코드</Label><Input name="barcode" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>기준가</Label><Input name="standardPrice" type="number" defaultValue="0" /></div>
                <div className="space-y-2"><Label>안전재고</Label><Input name="safetyStock" type="number" defaultValue="0" /></div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '품목 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={[...columns, { id: 'delete', header: '', cell: ({ row }: any) => <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id, row.original.itemName)}><Trash2 className="h-4 w-4" /></Button>, size: 50 }]} data={items} isLoading={isLoading} pageSize={50} onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }} />
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="품목 대량등록"
        apiEndpoint="/inventory/items/import"
        templateColumns={importTemplateColumns}
        templateFileName="품목_업로드_템플릿"
        keyMap={importKeyMap}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['inventory-items'] })}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="품목 삭제"
        description={`[${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
