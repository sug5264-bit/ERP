'use client'

import { useState, useMemo } from 'react'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { toast } from 'sonner'

interface AttendanceRow {
  id: string
  workDate: string
  checkInTime: string | null
  checkOutTime: string | null
  attendanceType: string
  workHours: number | null
  overtimeHours: number | null
  note: string | null
  employee: {
    employeeNo: string
    nameKo: string
    department: { name: string } | null
  }
}

const TYPE_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NORMAL: { label: '정상', variant: 'default' },
  LATE: { label: '지각', variant: 'destructive' },
  EARLY: { label: '조퇴', variant: 'secondary' },
  ABSENT: { label: '결근', variant: 'destructive' },
  BUSINESS: { label: '출장', variant: 'outline' },
  REMOTE: { label: '재택', variant: 'outline' },
}

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const columns: ColumnDef<AttendanceRow>[] = [
  {
    accessorKey: 'workDate',
    header: '근무일',
    cell: ({ row }) => formatDate(row.original.workDate),
  },
  {
    header: '사번',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.employee.employeeNo}</span>
    ),
  },
  {
    header: '이름',
    cell: ({ row }) => row.original.employee.nameKo,
  },
  {
    header: '부서',
    cell: ({ row }) => row.original.employee.department?.name || '-',
  },
  {
    header: '유형',
    cell: ({ row }) => {
      const t = TYPE_MAP[row.original.attendanceType]
      return t ? <Badge variant={t.variant}>{t.label}</Badge> : row.original.attendanceType
    },
  },
  {
    header: '출근',
    cell: ({ row }) => row.original.checkInTime?.slice(11, 16) || '-',
  },
  {
    header: '퇴근',
    cell: ({ row }) => row.original.checkOutTime?.slice(11, 16) || '-',
  },
  {
    header: '근무시간',
    cell: ({ row }) =>
      row.original.workHours != null ? `${row.original.workHours}h` : '-',
  },
  {
    header: '초과근무',
    cell: ({ row }) =>
      row.original.overtimeHours ? `${row.original.overtimeHours}h` : '-',
  },
]

const exportColumns: ExportColumn[] = [
  { header: '근무일', accessor: (r) => r.workDate ? formatDate(r.workDate) : '' },
  { header: '사번', accessor: (r) => r.employee?.employeeNo || '' },
  { header: '이름', accessor: (r) => r.employee?.nameKo || '' },
  { header: '부서', accessor: (r) => r.employee?.department?.name || '' },
  { header: '유형', accessor: (r) => TYPE_MAP[r.attendanceType]?.label || r.attendanceType },
  { header: '출근', accessor: (r) => r.checkInTime?.slice(11, 16) || '' },
  { header: '퇴근', accessor: (r) => r.checkOutTime?.slice(11, 16) || '' },
  { header: '근무시간', accessor: (r) => r.workHours != null ? `${r.workHours}h` : '' },
  { header: '초과근무', accessor: (r) => r.overtimeHours ? `${r.overtimeHours}h` : '' },
]

export default function AttendancePage() {
  const [open, setOpen] = useState(false)
  const [filterYear, setFilterYear] = useState(currentYear.toString())
  const [filterMonth, setFilterMonth] = useState(currentMonth.toString())
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['hr-attendance'],
    queryFn: () => api.get('/hr/attendance?pageSize=50') as Promise<any>,
  })

  const { data: empData } = useQuery({
    queryKey: ['hr-employees-list'],
    queryFn: () => api.get('/hr/employees?pageSize=500&status=ACTIVE') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/attendance', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] })
      setOpen(false)
      toast.success('근태가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const allRecords: AttendanceRow[] = data?.data || []
  const employees = empData?.data || []

  // 월 단위 필터 적용
  const records = useMemo(() => {
    return allRecords.filter((r) => {
      if (!r.workDate) return false
      const date = new Date(r.workDate)
      return (
        date.getFullYear() === Number(filterYear) &&
        date.getMonth() + 1 === Number(filterMonth)
      )
    })
  }, [allRecords, filterYear, filterMonth])

  // 근태 통계
  const stats = useMemo(() => {
    const normal = records.filter((r) => r.attendanceType === 'NORMAL').length
    const late = records.filter((r) => r.attendanceType === 'LATE').length
    const absent = records.filter((r) => r.attendanceType === 'ABSENT').length
    const remote = records.filter((r) => r.attendanceType === 'REMOTE').length
    return { normal, late, absent, remote }
  }, [records])

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      employeeId: form.get('employeeId'),
      workDate: form.get('workDate'),
      checkInTime: form.get('checkInTime')
        ? `${form.get('workDate')}T${form.get('checkInTime')}:00`
        : undefined,
      checkOutTime: form.get('checkOutTime')
        ? `${form.get('workDate')}T${form.get('checkOutTime')}:00`
        : undefined,
      attendanceType: form.get('attendanceType'),
      note: form.get('note') || undefined,
    })
  }

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '근태목록', title: '근태관리 목록', columns: exportColumns, data: records }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="근태관리"
        description="사원들의 출퇴근 기록을 관리합니다"
      />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="space-y-2">
          <Label>연도</Label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}년</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>월</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={m.toString()}>{m}월</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>근태 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>근태 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>사원 <span className="text-destructive">*</span></Label>
                <Select name="employeeId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="사원 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.employeeNo} - {e.nameKo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>근무일 <span className="text-destructive">*</span></Label>
                  <Input name="workDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>근태유형 <span className="text-destructive">*</span></Label>
                  <Select name="attendanceType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_MAP).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>출근시간</Label>
                  <Input name="checkInTime" type="time" />
                </div>
                <div className="space-y-2">
                  <Label>퇴근시간</Label>
                  <Input name="checkOutTime" type="time" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>비고</Label>
                <Input name="note" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '근태 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 근태 통계 요약 바 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">정상</p>
          <p className="text-2xl font-bold text-green-600">{stats.normal}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">지각</p>
          <p className="text-2xl font-bold text-red-600">{stats.late}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">결근</p>
          <p className="text-2xl font-bold text-red-600">{stats.absent}건</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">재택</p>
          <p className="text-2xl font-bold text-blue-600">{stats.remote}건</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        pageSize={50}
        searchColumn="workDate"
        searchPlaceholder="근무일로 검색..."
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
    </div>
  )
}
