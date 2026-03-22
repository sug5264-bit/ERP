'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface SettlementRow {
  id: string
  shipperId: string
  companyName: string
  period: string
  totalOrders: number
  totalShippingCost: number
  totalSurcharge: number
  totalAmount: number
  status: string
  paidAt: string | null
}

function StatusCell({ row, onMarkPaid }: { row: SettlementRow; onMarkPaid: (row: SettlementRow) => void }) {
  const s = row.status
  if (s === 'PAID') {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-green-500 hover:bg-green-600">지급완료</Badge>
        {row.paidAt && <span className="text-muted-foreground text-xs">{formatDate(row.paidAt)}</span>}
      </div>
    )
  }
  if (s === 'CONFIRMED') {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-600">
          확정
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onMarkPaid(row)
          }}
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          지급처리
        </Button>
      </div>
    )
  }
  return (
    <Badge variant="outline" className="text-yellow-600">
      처리중
    </Badge>
  )
}

function getColumns(onMarkPaid: (row: SettlementRow) => void): ColumnDef<SettlementRow>[] {
  return [
    {
      accessorKey: 'companyName',
      header: '화주사',
      cell: ({ row }) => <span className="font-medium">{row.original.companyName}</span>,
    },
    {
      accessorKey: 'period',
      header: '정산기간',
      cell: ({ row }) => row.original.period || '-',
    },
    {
      accessorKey: 'totalOrders',
      header: '주문건수',
      cell: ({ row }) => row.original.totalOrders?.toLocaleString() || '0',
    },
    {
      id: 'totalShippingCost',
      header: '배송비',
      cell: ({ row }) => formatCurrency(row.original.totalShippingCost),
    },
    {
      id: 'totalSurcharge',
      header: '부가요금',
      cell: ({ row }) => formatCurrency(row.original.totalSurcharge),
    },
    {
      id: 'totalAmount',
      header: '합계',
      cell: ({ row }) => <span className="font-bold">{formatCurrency(row.original.totalAmount)}</span>,
    },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => <StatusCell row={row.original} onMarkPaid={onMarkPaid} />,
    },
  ]
}

export default function SettlementPage() {
  const queryClient = useQueryClient()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<SettlementRow | null>(null)

  const qp = new URLSearchParams()
  if (startDate) qp.set('startDate', startDate)
  if (endDate) qp.set('endDate', endDate)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['3pl-settlement', startDate, endDate],
    queryFn: () => api.get(`/sales/3pl/settlement?${qp.toString()}`) as Promise<{ data: SettlementRow[] }>,
  })

  const settlements: SettlementRow[] = data?.data || []

  const totalAmount = settlements.reduce((sum, s) => sum + (s.totalAmount || 0), 0)
  const totalOrders = settlements.reduce((sum, s) => sum + (s.totalOrders || 0), 0)
  const uniqueShippers = new Set(settlements.map((s) => s.companyName)).size

  const handleMarkPaid = async (row: SettlementRow) => {
    try {
      // Check if already paid to prevent duplicate notes
      const existing = await api.get(`/notes?relatedTable=SettlementPaid&relatedId=${row.shipperId}_${row.period}`)
      if (existing?.data?.length > 0) {
        toast.info('이미 지급 처리된 정산입니다.')
        queryClient.invalidateQueries({ queryKey: ['3pl-settlement'] })
        setConfirmTarget(null)
        return
      }
      await api.post('/notes', {
        content: `${row.companyName} ${row.period} 정산 지급완료`,
        relatedTable: 'SettlementPaid',
        relatedId: `${row.shipperId}_${row.period}`,
      })
      queryClient.invalidateQueries({ queryKey: ['3pl-settlement'] })
      toast.success(`${row.companyName} ${row.period} 정산이 지급 처리되었습니다.`)
    } catch {
      toast.error('지급 처리에 실패했습니다.')
    }
    setConfirmTarget(null)
  }

  const columns = getColumns((row) => setConfirmTarget(row))

  return (
    <div className="space-y-6">
      <PageHeader title="정산관리" description="화주사별 배송비 정산을 관리합니다" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">총 정산액</p>
          <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">총 주문건수</p>
          <p className="text-2xl font-bold">{totalOrders.toLocaleString()}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">화주사 수</p>
          <p className="text-2xl font-bold">{uniqueShippers}사</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          className="w-full sm:w-36"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="시작일"
        />
        <span className="text-muted-foreground text-xs">~</span>
        <Input
          type="date"
          className="w-full sm:w-36"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="종료일"
        />
      </div>

      <DataTable
        columns={columns}
        data={settlements}
        searchColumn="companyName"
        searchPlaceholder="화주사명으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        pageSize={50}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(v) => !v && setConfirmTarget(null)}
        title="정산 지급 처리"
        description={
          confirmTarget
            ? `${confirmTarget.companyName} ${confirmTarget.period} 정산을 지급 완료 처리하시겠습니까? (${formatCurrency(confirmTarget.totalAmount)})`
            : ''
        }
        onConfirm={() => {
          if (confirmTarget) handleMarkPaid(confirmTarget)
        }}
      />
    </div>
  )
}
