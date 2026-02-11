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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate, formatCurrency } from '@/lib/format'
import { toast } from 'sonner'

const STATUS_MAP: Record<string, string> = { PENDING: '대기', PAID: '지급완료', CANCELLED: '취소' }
const PAYMENT_METHODS = ['계좌이체', '어음', '현금', '카드']

const columns: ColumnDef<any>[] = [
  { accessorKey: 'paymentNo', header: '지급번호', cell: ({ row }) => <span className="font-mono text-xs">{row.original.paymentNo}</span> },
  { header: '지급일', cell: ({ row }) => formatDate(row.original.paymentDate) },
  { header: '거래처', cell: ({ row }) => row.original.partner?.partnerName || '-' },
  { header: '결제방법', cell: ({ row }) => row.original.paymentMethod || '-' },
  { header: '금액', cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span> },
  { header: '비고', cell: ({ row }) => row.original.description || '-' },
  { header: '상태', cell: ({ row }) => <Badge variant="outline">{STATUS_MAP[row.original.status] || row.original.status}</Badge> },
]

export default function PaymentsPage() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['procurement-payments'], queryFn: () => api.get('/procurement/payments?pageSize=50') as Promise<any> })
  const { data: partnersData } = useQuery({ queryKey: ['partners-purchase'], queryFn: () => api.get('/partners?pageSize=500') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/procurement/payments', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['procurement-payments'] }); setOpen(false); toast.success('구매대금이 등록되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const partners = partnersData?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      paymentDate: form.get('paymentDate'), partnerId: form.get('partnerId'),
      totalAmount: parseFloat(form.get('totalAmount') as string) || 0,
      paymentMethod: form.get('paymentMethod') || undefined,
      description: form.get('description') || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="구매대금" description="공급업체 대금 지급을 관리합니다" />
      <div className="flex items-center gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>대금 등록</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>구매대금 등록</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>지급일 *</Label><Input name="paymentDate" type="date" required /></div>
                <div className="space-y-2">
                  <Label>거래처 *</Label>
                  <Select name="partnerId"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.partnerName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>금액 *</Label><Input name="totalAmount" type="number" required /></div>
                <div className="space-y-2">
                  <Label>결제방법</Label>
                  <Select name="paymentMethod"><SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>비고</Label><Input name="description" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '등록 중...' : '대금 등록'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={data?.data || []} searchColumn="paymentNo" searchPlaceholder="지급번호로 검색..." isLoading={isLoading} pageSize={50} />
    </div>
  )
}
