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

import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface PayrollRow {
  id: string
  payPeriod: string
  payDate: string
  status: string
  _count: { details: number }
}

const columns: ColumnDef<PayrollRow>[] = [
  { accessorKey: 'payPeriod', header: '급여기간' },
  { id: 'payDate', header: '지급일', cell: ({ row }) => formatDate(row.original.payDate) },
  { id: 'count', header: '대상인원', cell: ({ row }) => `${row.original._count?.details || 0}명` },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) =>
      row.original.status === 'CONFIRMED' ? <Badge>확정</Badge> : <Badge variant="secondary">임시</Badge>,
  },
]

export default function PayrollPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedPayroll, setSelectedPayroll] = useState<Record<string, unknown> | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => api.get('/payroll?pageSize=50'),
  })

  const payrollList = data?.data || []

  // 요약 통계
  const summary = {
    totalCount: payrollList.length,
    confirmed: payrollList.filter((p: PayrollRow) => p.status === 'CONFIRMED').length,
    draft: payrollList.filter((p: PayrollRow) => p.status !== 'CONFIRMED').length,
    totalPersons: payrollList.reduce((s: number, p: PayrollRow) => s + (p._count?.details || 0), 0),
  }

  const exportColumns: ExportColumn[] = [
    { header: '급여기간', accessor: 'payPeriod' },
    { header: '지급일', accessor: (r) => (r.payDate ? formatDate(r.payDate) : '') },
    { header: '대상인원', accessor: (r) => `${r._count?.details || 0}명` },
    { header: '상태', accessor: (r) => (r.status === 'CONFIRMED' ? '확정' : '임시') },
  ]

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '급여목록', title: '급여관리 목록', columns: exportColumns, data: payrollList }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/payroll', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      setOpen(false)
      toast.success('급여가 생성되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => api.put(`/payroll/${id}`, { status: 'CONFIRMED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      setDetailOpen(false)
      toast.success('급여가 확정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({ payPeriod: form.get('payPeriod'), payDate: form.get('payDate') })
  }

  const handleRowClick = async (row: PayrollRow) => {
    try {
      const res = (await api.get(`/payroll/${row.id}`)) as Record<string, unknown>
      setSelectedPayroll((res.data || res) as Record<string, unknown>)
      setDetailOpen(true)
    } catch {
      toast.error('급여 데이터를 불러올 수 없습니다.')
    }
  }

  const details = (selectedPayroll?.details || []) as Record<string, unknown>[]
  const totals = details.reduce(
    (acc: { totalEarnings: number; totalDeductions: number; netPay: number }, d: Record<string, unknown>) => ({
      totalEarnings: acc.totalEarnings + Number(d.totalEarnings || 0),
      totalDeductions: acc.totalDeductions + Number(d.totalDeductions || 0),
      netPay: acc.netPay + Number(d.netPay || 0),
    }),
    { totalEarnings: 0, totalDeductions: 0, netPay: 0 }
  )

  const detailColumns: ColumnDef<Record<string, unknown>>[] = [
    { accessorKey: 'employee.employeeNo', header: '사번', id: 'empNo' },
    {
      id: 'name',
      accessorFn: (row) => (row.employee as Record<string, unknown>)?.nameKo || '',
      header: '이름',
      cell: ({ row }) => (row.original.employee as Record<string, string> | undefined)?.nameKo || '-',
    },
    {
      id: 'dept',
      header: '부서',
      cell: ({ row }) =>
        (
          (row.original.employee as Record<string, unknown> | undefined)?.department as
            | Record<string, string>
            | undefined
        )?.name || '-',
    },
    { id: 'baseSalary', header: '기본급', cell: ({ row }) => formatCurrency(Number(row.original.baseSalary)) },
    {
      id: 'totalEarnings',
      header: '총지급액',
      cell: ({ row }) => (
        <span className="text-status-info font-medium">{formatCurrency(Number(row.original.totalEarnings))}</span>
      ),
    },
    {
      id: 'totalDeductions',
      header: '총공제액',
      cell: ({ row }) => (
        <span className="text-status-danger">{formatCurrency(Number(row.original.totalDeductions))}</span>
      ),
    },
    {
      id: 'netPay',
      header: '실수령액',
      cell: ({ row }) => <span className="font-bold">{formatCurrency(Number(row.original.netPay))}</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="급여 관리" description="월별 급여를 생성하고 관리합니다" />

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">전체 건수</p>
          <p className="text-sm font-bold sm:text-lg">{summary.totalCount}건</p>
        </div>
        <div className="bg-status-info-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">총 대상인원</p>
          <p className="text-status-info text-sm font-bold sm:text-lg">{summary.totalPersons}명</p>
        </div>
        <div className="bg-status-success-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">확정</p>
          <p className="text-status-success text-sm font-bold sm:text-lg">{summary.confirmed}건</p>
        </div>
        <div className="bg-status-warning-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">임시</p>
          <p className="text-status-warning text-sm font-bold sm:text-lg">{summary.draft}건</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>급여 생성</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>급여 생성</DialogTitle>
              <p className="text-muted-foreground text-xs">
                <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
              </p>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>
                  급여기간 <span className="text-destructive">*</span>
                </Label>
                <Input name="payPeriod" type="month" required aria-required="true" />
              </div>
              <div className="space-y-2">
                <Label>
                  지급일 <span className="text-destructive">*</span>
                </Label>
                <Input name="payDate" type="date" required aria-required="true" />
              </div>
              <p className="text-muted-foreground text-xs">전체 재직 사원의 급여가 자동 계산되어 생성됩니다.</p>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '생성 중...' : '급여 생성'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={data?.data || []}
        searchColumn="payPeriod"
        searchPlaceholder="급여기간 검색..."
        isLoading={isLoading}
        pageSize={50}
        onRowClick={handleRowClick}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{String(selectedPayroll?.payPeriod ?? '')} 급여명세</DialogTitle>
          </DialogHeader>
          {selectedPayroll && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">대상인원</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-xl font-bold">{details.length}명</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">총지급액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-status-info text-lg font-bold">{formatCurrency(totals.totalEarnings)}</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">총공제액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-status-danger text-lg font-bold">
                      {formatCurrency(totals.totalDeductions)}
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">총실수령액</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-lg font-bold">{formatCurrency(totals.netPay)}</span>
                  </CardContent>
                </Card>
              </div>
              <DataTable
                columns={detailColumns}
                data={details}
                searchColumn="name"
                searchPlaceholder="이름 검색..."
                pageSize={20}
              />
              {selectedPayroll.status !== 'CONFIRMED' && (
                <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={confirmMutation.isPending}>
                  급여 확정
                </Button>
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
        onConfirm={() => {
          if (selectedPayroll) confirmMutation.mutate(selectedPayroll.id as string)
        }}
        isPending={confirmMutation.isPending}
      />
    </div>
  )
}
