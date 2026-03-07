'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { CalendarX2, AlertTriangle } from 'lucide-react'

interface ExpiryItem {
  id: string
  itemCode: string
  itemName: string
  barcode?: string
  lotNo: string
  expiryDate: string
  daysLeft: number
  stockQty: number
  warehouseName: string
}

const DAYS_OPTIONS = [
  { value: '7', label: '7일 이내' },
  { value: '14', label: '14일 이내' },
  { value: '30', label: '30일 이내' },
  { value: '60', label: '60일 이내' },
  { value: '90', label: '90일 이내' },
]

function getDaysLeftColor(daysLeft: number) {
  if (daysLeft <= 7) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
  if (daysLeft <= 30) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
  return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
}

const columns: ColumnDef<ExpiryItem>[] = [
  {
    accessorKey: 'barcode',
    header: '바코드',
    cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.barcode || '-'}</span>,
  },
  {
    accessorKey: 'itemCode',
    header: '품목코드',
    cell: ({ row }) => <span className="text-muted-foreground font-mono text-xs">{row.original.itemCode}</span>,
  },
  {
    accessorKey: 'itemName',
    header: '내품명',
    cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.original.itemName}</span>,
  },
  {
    accessorKey: 'lotNo',
    header: 'LOT번호',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-mono text-xs">
        {row.original.lotNo}
      </Badge>
    ),
  },
  {
    accessorKey: 'expiryDate',
    header: '유통기한',
    cell: ({ row }) => formatDate(row.original.expiryDate),
  },
  {
    accessorKey: 'daysLeft',
    header: '남은일수',
    cell: ({ row }) => {
      const days = row.original.daysLeft
      return (
        <Badge variant="outline" className={`border-0 font-medium ${getDaysLeftColor(days)}`}>
          {days <= 0 ? (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> 만료
            </span>
          ) : (
            `${days}일`
          )}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'stockQty',
    header: '재고수량',
    cell: ({ row }) => <span className="tabular-nums">{row.original.stockQty?.toLocaleString()}</span>,
  },
  {
    accessorKey: 'warehouseName',
    header: '창고',
  },
]

export default function ExpiryManagementPage() {
  const [daysFilter, setDaysFilter] = useState('30')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory-expiry', daysFilter],
    queryFn: () => api.get(`/inventory/expiry?daysLeft=${daysFilter}`),
  })

  const items = (data?.data || []) as ExpiryItem[]

  const expiredCount = items.filter((i) => i.daysLeft <= 0).length
  const urgentCount = items.filter((i) => i.daysLeft > 0 && i.daysLeft <= 7).length
  const warningCount = items.filter((i) => i.daysLeft > 7 && i.daysLeft <= 30).length

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="유통기한관리" description="제품의 유통기한을 추적하고 관리합니다" />

      {!isLoading && items.length > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {expiredCount > 0 && (
            <Badge variant="outline" className="border-0 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
              만료 {expiredCount}건
            </Badge>
          )}
          {urgentCount > 0 && (
            <Badge
              variant="outline"
              className="border-0 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
            >
              7일 이내 {urgentCount}건
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge
              variant="outline"
              className="border-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            >
              30일 이내 {warningCount}건
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <Select value={daysFilter} onValueChange={setDaysFilter}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder="기간 선택" />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={items}
        searchPlaceholder="품목명, LOT번호 검색..."
        searchColumn="itemName"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </div>
  )
}
