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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

const columns: ColumnDef<any>[] = [
  { accessorKey: 'payPeriod', header: '급여기간' },
  { id: 'payDate', header: '지급일', cell: ({ row }) => formatDate(row.original.payDate) },
  { id: 'count', header: '대상인원', cell: ({ row }) => `${row.original._count?.details || 0}명` },
  { id: 'status', header: '상태', cell: ({ row }) => row.original.status === 'CONFIRMED' ? <Badge>확정</Badge> : <Badge variant="secondary">임시</Badge> },
]

export default function PayrollPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({ queryKey: ['payroll'], queryFn: () => api.get('/payroll?pageSize=50') as Promise<any> })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/payroll', body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll'] }); setOpen(false); toast.success('급여가 생성되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/${id}`, { status: 'CONFIRMED' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['payroll'] }); setDetailOpen(false); toast.success('급여가 확정되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({ payPeriod: form.get('payPeriod'), payDate: form.get('payDate') })
  }

  const handleRowClick = async (row: any) => {
    try {
      const res = await api.get(`/payroll/${row.id}`) as any
      setSelectedPayroll(res.data || res)
      setDetailOpen(true)
    } catch { toast.error('급여 데이터를 불러올 수 없습니다.') }
  }

  const details = selectedPayroll?.details || []
  const totals = details.reduce((acc: any, d: any) => ({
    totalEarnings: acc.totalEarnings + Number(d.totalEarnings || 0),
    totalDeductions: acc.totalDeductions + Number(d.totalDeductions || 0),
    netPay: acc.netPay + Number(d.netPay || 0),
  }), { totalEarnings: 0, totalDeductions: 0, netPay: 0 })

  const detailColumns: ColumnDef<any>[] = [
    { accessorKey: 'employee.employeeNo', header: '사번', id: 'empNo' },
    { id: 'name', header: '이름', cell: ({ row }) => row.original.employee?.nameKo || '-' },
    { id: 'dept', header: '부서', cell: ({ row }) => row.original.employee?.department?.name || '-' },
    { id: 'baseSalary', header: '기본급', cell: ({ row }) => formatCurrency(Number(row.original.baseSalary)) },
    { id: 'totalEarnings', header: '총지급액', cell: ({ row }) => <span className="font-medium text-blue-600">{formatCurrency(Number(row.original.totalEarnings))}</span> },
    { id: 'totalDeductions', header: '총공제액', cell: ({ row }) => <span className="text-red-600">{formatCurrency(Number(row.original.totalDeductions))}</span> },
    { id: 'netPay', header: '실수령액', cell: ({ row }) => <span className="font-bold">{formatCurrency(Number(row.original.netPay))}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="급여 관리" description="월별 급여를 생성하고 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>급여 생성</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>급여 생성</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>급여기간 <span className="text-destructive">*</span></Label><Input name="payPeriod" type="month" required aria-required="true" /></div>
              <div className="space-y-2"><Label>지급일 <span className="text-destructive">*</span></Label><Input name="payDate" type="date" required aria-required="true" /></div>
              <p className="text-xs text-muted-foreground">전체 재직 사원의 급여가 자동 계산되어 생성됩니다.</p>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>{createMutation.isPending ? '생성 중...' : '급여 생성'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable columns={columns} data={data?.data || []} searchColumn="payPeriod" searchPlaceholder="급여기간 검색..." isLoading={isLoading} pageSize={50} onRowClick={handleRowClick} />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedPayroll?.payPeriod} 급여명세</DialogTitle></DialogHeader>
          {selectedPayroll && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">대상인원</CardTitle></CardHeader><CardContent><span className="text-xl font-bold">{details.length}명</span></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">총지급액</CardTitle></CardHeader><CardContent><span className="text-lg font-bold text-blue-600">{formatCurrency(totals.totalEarnings)}</span></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">총공제액</CardTitle></CardHeader><CardContent><span className="text-lg font-bold text-red-600">{formatCurrency(totals.totalDeductions)}</span></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">총실수령액</CardTitle></CardHeader><CardContent><span className="text-lg font-bold">{formatCurrency(totals.netPay)}</span></CardContent></Card>
              </div>
              <DataTable columns={detailColumns} data={details} searchColumn="name" searchPlaceholder="이름 검색..." pageSize={20} />
              {selectedPayroll.status !== 'CONFIRMED' && (
                <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={confirmMutation.isPending}>급여 확정</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="급여 확정"
        description={`${selectedPayroll?.payPeriod} 급여를 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.`}
        confirmLabel="확정"
        onConfirm={() => selectedPayroll && confirmMutation.mutate(selectedPayroll.id)}
        isPending={confirmMutation.isPending}
      />
    </div>
  )
}
