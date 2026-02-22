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

export default function AttendancePage() {
  const [open, setOpen] = useState(false)
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

  const records: AttendanceRow[] = data?.data || []
  const employees = empData?.data || []

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="근태관리"
        description="사원들의 출퇴근 기록을 관리합니다"
      />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>근태 등록</Button>
          </DialogTrigger>
          <DialogContent>
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
      <DataTable
        columns={columns}
        data={records}
        isLoading={isLoading}
        pageSize={50}
      />
    </div>
  )
}
