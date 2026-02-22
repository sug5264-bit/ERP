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
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from 'sonner'

interface ReturnRow {
  id: string
  returnNo: string
  returnDate: string
  reason: string
  reasonDetail: string | null
  status: string
  totalAmount: number
  salesOrder: { id: string; orderNo: string } | null
  partner: { id: string; partnerName: string } | null
}

const REASON_MAP: Record<string, string> = {
  DEFECT: '불량',
  WRONG_ITEM: '오배송',
  CUSTOMER_CHANGE: '고객변심',
  QUALITY_ISSUE: '품질문제',
  OTHER: '기타',
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  REQUESTED: { label: '요청', variant: 'outline' },
  APPROVED: { label: '승인', variant: 'default' },
  COMPLETED: { label: '완료', variant: 'secondary' },
  REJECTED: { label: '반려', variant: 'destructive' },
}

export default function ReturnsPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-returns', statusFilter],
    queryFn: () => api.get(`/sales/returns?${qp.toString()}`) as Promise<any>,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['sales-orders-for-return'],
    queryFn: () => api.get('/sales/orders?pageSize=200') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const { data: partnersData } = useQuery({
    queryKey: ['partners-all'],
    queryFn: () => api.get('/partners?pageSize=200') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/sales/returns', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      setCreateOpen(false)
      toast.success('반품이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/sales/returns/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] })
      toast.success('상태가 변경되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      salesOrderId: form.get('salesOrderId'),
      partnerId: form.get('partnerId'),
      returnDate: form.get('returnDate'),
      reason: form.get('reason'),
      reasonDetail: form.get('reasonDetail') || undefined,
      totalAmount: parseFloat(form.get('totalAmount') as string) || 0,
    })
  }

  const returns: ReturnRow[] = data?.data || []
  const orders = ordersData?.data || []
  const partners = (partnersData?.data || [])

  const columns: ColumnDef<ReturnRow>[] = [
    { accessorKey: 'returnNo', header: '반품번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.returnNo}</span> },
    { accessorKey: 'returnDate', header: '반품일', cell: ({ row }) => formatDate(row.original.returnDate) },
    { id: 'partner', header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
    { id: 'orderNo', header: '수주번호', cell: ({ row }) => row.original.salesOrder?.orderNo || '-' },
    { id: 'reason', header: '사유', cell: ({ row }) => <Badge variant="outline">{REASON_MAP[row.original.reason] || row.original.reason}</Badge> },
    { accessorKey: 'totalAmount', header: '반품금액', cell: ({ row }) => formatCurrency(row.original.totalAmount) },
    {
      id: 'status',
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => row.original.status === 'REQUESTED' ? (
        <div className="flex gap-1">
          <Button variant="outline" size="sm" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'APPROVED' })}>승인</Button>
          <Button variant="outline" size="sm" className="text-destructive" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'REJECTED' })}>반려</Button>
        </div>
      ) : row.original.status === 'APPROVED' ? (
        <Button variant="outline" size="sm" disabled={updateStatusMutation.isPending} onClick={() => updateStatusMutation.mutate({ id: row.original.id, status: 'COMPLETED' })}>완료</Button>
      ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="반품관리" description="매출 반품을 등록하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="전체 상태" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)}>반품 등록</Button>
      </div>
      <DataTable columns={columns} data={returns} searchColumn="returnNo" searchPlaceholder="반품번호로 검색..." isLoading={isLoading} />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>반품 등록</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>수주 선택 *</Label>
                <Select name="salesOrderId" required>
                  <SelectTrigger><SelectValue placeholder="수주 선택" /></SelectTrigger>
                  <SelectContent>
                    {orders.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>[{o.orderNo}] {o.partner?.partnerName || ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>거래처 *</Label>
                <Select name="partnerId" required>
                  <SelectTrigger><SelectValue placeholder="거래처 선택" /></SelectTrigger>
                  <SelectContent>
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>반품일 *</Label>
                <Input name="returnDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-2">
                <Label>반품사유 *</Label>
                <Select name="reason" required>
                  <SelectTrigger><SelectValue placeholder="사유 선택" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>반품금액</Label>
                <Input name="totalAmount" type="number" placeholder="0" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>상세 사유</Label>
              <Textarea name="reasonDetail" placeholder="반품 상세 사유를 입력하세요" />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? '등록 중...' : '반품 등록'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
