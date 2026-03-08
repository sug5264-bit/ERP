'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { StatusBadge } from '@/components/common/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'
import { ScanBarcode, Search } from 'lucide-react'

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: '입고',
  OUT: '출고',
  TRANSFER: '이동',
}

interface LotMovement {
  id: string
  movementNo: string
  movementDate: string
  movementType: string
  quantity: number
  fromWarehouse: string | null
  toWarehouse: string | null
}

const columns: ColumnDef<LotMovement>[] = [
  {
    accessorKey: 'movementNo',
    header: '이동번호',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.movementNo}</span>,
  },
  {
    accessorKey: 'movementDate',
    header: '이동일',
    cell: ({ row }) => formatDate(row.original.movementDate),
  },
  {
    accessorKey: 'movementType',
    header: '이동유형',
    cell: ({ row }) => <StatusBadge status={row.original.movementType} labels={MOVEMENT_TYPE_LABELS} />,
  },
  {
    accessorKey: 'quantity',
    header: '수량',
    cell: ({ row }) => <span className="tabular-nums font-medium">{row.original.quantity?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'fromWarehouse',
    header: '출발창고',
    cell: ({ row }) => row.original.fromWarehouse || '-',
  },
  {
    accessorKey: 'toWarehouse',
    header: '도착창고',
    cell: ({ row }) => row.original.toWarehouse || '-',
  },
]

export default function LotTrackingPage() {
  const [lotNo, setLotNo] = useState('')
  const [searchLotNo, setSearchLotNo] = useState('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-lot-tracking', searchLotNo],
    queryFn: () => api.get(`/inventory/lot-tracking?lotNo=${searchLotNo}`),
    enabled: !!searchLotNo,
  })

  const items = (data?.data || []) as LotMovement[]

  const exportColumns: ExportColumn[] = [
    { header: '이동번호', accessor: 'movementNo' },
    { header: '이동일', accessor: (r) => formatDate(r.movementDate) },
    { header: '이동유형', accessor: (r) => MOVEMENT_TYPE_LABELS[r.movementType] || r.movementType },
    { header: '수량', accessor: (r) => r.quantity?.toLocaleString() },
    { header: '출발창고', accessor: (r) => r.fromWarehouse || '-' },
    { header: '도착창고', accessor: (r) => r.toWarehouse || '-' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: `LOT추적_${searchLotNo}`, title: `LOT추적 이력 (${searchLotNo})`, columns: exportColumns, data: items }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleSearch = () => {
    if (lotNo.trim()) {
      setSearchLotNo(lotNo.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="LOT추적"
        description="제품의 LOT 번호를 기반으로 입출고 이력을 추적합니다"
      />

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">LOT 번호</Label>
          <div className="flex gap-2">
            <Input
              value={lotNo}
              onChange={(e) => setLotNo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="LOT 번호를 입력하세요"
              className="h-8 w-64 text-sm"
            />
            <Button size="sm" className="h-8" onClick={handleSearch}>
              <Search className="mr-1 h-3.5 w-3.5" /> 조회
            </Button>
          </div>
        </div>
      </div>

      {searchLotNo && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            <ScanBarcode className="mr-1 h-3 w-3" />
            {searchLotNo}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {items.length > 0 ? `${items.length}건의 이력이 조회되었습니다.` : ''}
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="이동번호 검색..."
        searchColumn="movementNo"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
    </div>
  )
}
