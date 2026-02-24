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
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { exportToCSV } from '@/lib/export/csv-export'
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

  const payrollList = data?.data || []

  // 요약 통계
  const summary = {
    totalCount: payrollList.length,
    confirmed: payrollList.filter((p: any) => p.status === 'CONFIRMED').length,
    draft: payrollList.filter((p: any) => p.status !== 'CONFIRMED').length,
    totalPersons: payrollList.reduce((s: number, p: any) => s + (p._count?.details || 0), 0),
  }

  const exportColumns: ExportColumn[] = [
    { header: '급여기간', accessor: 'payPeriod' },
    { header: '지급일', accessor: (r) => r.payDate ? formatDate(r.payDate) : '' },
    { header: '대상인원', accessor: (r) => `${r._count?.details || 0}명` },
    { header: '상태', accessor: (r) => r.status === 'CONFIRMED' ? '확정' : '임시' },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '급여목록', title: '급여관리 목록', columns: exportColumns, data: payrollList }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

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
    { id: 'totalEarnings', header: '총지급액', cell: ({ row }) => <span className="font-medium text-blue-600 dark:text-blue-500">{formatCurrency(Number(row.original.totalEarnings))}</span> },
    { id: 'totalDeductions', header: '총공제액', cell: ({ row }) => <span className="text-red-600 dark:text-red-500">{formatCurrency(Number(row.original.totalDeductions))}</span> },
    { id: 'netPay', header: '실수령액', cell: ({ row }) => <span className="font-bold">{formatCurrency(Number(row.original.netPay))}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="급여 관리" description="월별 급여를 생성하고 관리합니다" />

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg border bg-muted/30 p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">전체 건수</p>
          <p className="text-sm sm:text-lg font-bold">{summary.totalCount}건</p>
        </div>
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">총 대상인원</p>
          <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-500">{summary.totalPersons}명</p>
        </div>
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">확정</p>
          <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-500">{summary.confirmed}건</p>
        </div>
        <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/30 p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">임시</p>
          <p className="text-sm sm:text-lg font-bold text-yellow-600 dark:text-yellow-500">{summary.draft}건</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>급여 생성</Button></DialogTrigger>
          <DialogContent className="max-w-sm sm:max-w-xl max-h-[90vh] overflow-y-auto">
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
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">총지급액</CardTitle></CardHeader><CardContent><span className="text-lg font-bold text-blue-600 dark:text-blue-500">{formatCurrency(totals.totalEarnings)}</span></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">총공제액</CardTitle></CardHeader><CardContent><span className="text-lg font-bold text-red-600 dark:text-red-500">{formatCurrency(totals.totalDeductions)}</span></CardContent></Card>
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
