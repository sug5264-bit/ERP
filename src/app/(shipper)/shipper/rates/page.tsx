'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { DataTable } from '@/components/common/data-table'
import { SHIPPING_METHOD_LABELS } from '@/lib/constants'
import { formatCurrency, formatDate } from '@/lib/format'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ShipperRate {
  id: string
  rateName: string
  regionCode: string | null
  regionName: string | null
  weightMin: number | null
  weightMax: number | null
  baseRate: number
  surchargeRate: number | null
  shippingMethod: string
  effectiveFrom: string | null
  effectiveTo: string | null
  memo: string | null
}

const columns: ColumnDef<ShipperRate>[] = [
  { accessorKey: 'rateName', header: '요율명' },
  {
    accessorKey: 'shippingMethod',
    header: '배송방법',
    cell: ({ row }) =>
      SHIPPING_METHOD_LABELS[row.getValue('shippingMethod') as string] ?? row.getValue('shippingMethod'),
  },
  {
    accessorKey: 'regionName',
    header: '지역',
    cell: ({ row }) => {
      const name = row.original.regionName
      const code = row.original.regionCode
      if (name) return code ? `${name} (${code})` : name
      return code ?? '-'
    },
  },
  {
    id: 'weightRange',
    header: '중량(kg)',
    cell: ({ row }) => {
      const min = row.original.weightMin
      const max = row.original.weightMax
      if (min != null && max != null) return `${min} ~ ${max}`
      if (min != null) return `${min} 이상`
      if (max != null) return `${max} 이하`
      return '-'
    },
  },
  {
    accessorKey: 'baseRate',
    header: '기본단가',
    cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.getValue('baseRate') as number)}</span>,
  },
  {
    accessorKey: 'surchargeRate',
    header: '할증단가',
    cell: ({ row }) => {
      const v = row.getValue('surchargeRate') as number | null
      return v ? <span className="tabular-nums">{formatCurrency(v)}</span> : '-'
    },
  },
  {
    id: 'effectivePeriod',
    header: '적용기간',
    cell: ({ row }) => {
      const from = row.original.effectiveFrom
      const to = row.original.effectiveTo
      if (from && to) return `${formatDate(from)} ~ ${formatDate(to)}`
      if (from) return `${formatDate(from)} ~`
      if (to) return `~ ${formatDate(to)}`
      return '상시'
    },
  },
  {
    accessorKey: 'memo',
    header: '비고',
    cell: ({ row }) => row.getValue('memo') || '-',
  },
]

export default function ShipperRatesPage() {
  const [methodFilter, setMethodFilter] = useState<string>('all')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['shipper-rates', methodFilter],
    queryFn: () => {
      const qp = methodFilter !== 'all' ? `?shippingMethod=${methodFilter}` : ''
      return api.get(`/shipper/rates${qp}`)
    },
  })

  const rates = (data?.data || []) as ShipperRate[]

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader title="운임단가 조회" description="계약된 배송 요율을 확인합니다" />

        <div className="flex items-center gap-2">
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="전체 배송방법" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 배송방법</SelectItem>
              {Object.entries(SHIPPING_METHOD_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={rates}
          searchPlaceholder="요율명 검색..."
          searchColumn="rateName"
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
        />
      </div>
    </ShipperLayoutShell>
  )
}
