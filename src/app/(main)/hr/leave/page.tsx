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
import { CheckCircle, XCircle } from 'lucide-react'

interface LeaveRow {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: string
  createdAt: string
  employee: {
    employeeNo: string
    nameKo: string
    department: { name: string } | null
    position: { name: string } | null
  }
}

const LEAVE_TYPE_MAP: Record<string, string> = {
  ANNUAL: '연차',
  SICK: '병가',
  FAMILY: '경조사',
  MATERNITY: '출산',
  PARENTAL: '육아',
  OFFICIAL: '공가',
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  REQUESTED: { label: '승인대기', variant: 'outline' },
  APPROVED: { label: '승인', variant: 'default' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

export default function LeavePage() {
  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const queryClient = useQueryClient()

  const queryParams = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-leave', statusFilter],
    queryFn: () => api.get(`/hr/leave?${queryParams.toString()}`) as Promise<any>,
  })

  const { data: empData } = useQuery({
    queryKey: ['hr-employees-list'],
    queryFn: () => api.get('/hr/employees?pageSize=500&status=ACTIVE') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/leave', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] })
      setOpen(false)
      toast.success('휴가가 신청되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const actionMutation = useMutation({
    mutationFn: (body: { id: string; action: string }) => api.put('/hr/leave', body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave'] })
      const msg = variables.action === 'approve' ? '승인' : variables.action === 'reject' ? '반려' : '취소'
      toast.success(`휴가가 ${msg}되었습니다.`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const leaves: LeaveRow[] = data?.data || []
  const employees = empData?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const startDate = form.get('startDate') as string
    const endDate = form.get('endDate') as string
    const diffTime = new Date(endDate).getTime() - new Date(startDate).getTime()
    const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)

    createMutation.mutate({
      employeeId: form.get('employeeId'),
      leaveType: form.get('leaveType'),
      startDate,
      endDate,
      days,
      reason: form.get('reason') || undefined,
    })
  }

  const handleAction = (id: string, action: string, name: string) => {
    const actionLabel = action === 'approve' ? '승인' : action === 'reject' ? '반려' : '취소'
    if (confirm(`${name}님의 휴가를 ${actionLabel}하시겠습니까?`)) {
      actionMutation.mutate({ id, action })
    }
  }

  const columns: ColumnDef<LeaveRow>[] = [
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
      header: '직급',
      cell: ({ row }) => row.original.employee.position?.name || '-',
    },
    {
      header: '휴가유형',
      cell: ({ row }) => (
        <Badge variant="outline">
          {LEAVE_TYPE_MAP[row.original.leaveType] || row.original.leaveType}
        </Badge>
      ),
    },
    {
      header: '기간',
      cell: ({ row }) =>
        `${formatDate(row.original.startDate)} ~ ${formatDate(row.original.endDate)}`,
    },
    {
      accessorKey: 'days',
      header: '일수',
      cell: ({ row }) => `${row.original.days}일`,
    },
    {
      header: '사유',
      cell: ({ row }) => (
        <span className="max-w-[150px] truncate block" title={row.original.reason || '-'}>
          {row.original.reason || '-'}
        </span>
      ),
    },
    {
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status
      },
    },
    {
      id: 'actions',
      header: '승인처리',
      cell: ({ row }) => {
        const { status, id, employee } = row.original
        if (status !== 'REQUESTED') return null
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); handleAction(id, 'approve', employee.nameKo) }}
              disabled={actionMutation.isPending}
            >
              <CheckCircle className="mr-1 h-3 w-3" /> 승인
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); handleAction(id, 'reject', employee.nameKo) }}
              disabled={actionMutation.isPending}
            >
              <XCircle className="mr-1 h-3 w-3" /> 반려
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="휴가관리"
        description="휴가 신청 및 승인을 관리합니다"
      />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="REQUESTED">승인대기</SelectItem>
            <SelectItem value="APPROVED">승인</SelectItem>
            <SelectItem value="REJECTED">반려</SelectItem>
            <SelectItem value="CANCELLED">취소</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>휴가 신청</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>휴가 신청</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>사원 *</Label>
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
              <div className="space-y-2">
                <Label>휴가유형 *</Label>
                <Select name="leaveType" required>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시작일 *</Label>
                  <Input name="startDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label>종료일 *</Label>
                  <Input name="endDate" type="date" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>사유</Label>
                <Input name="reason" placeholder="휴가 사유를 입력하세요" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '신청 중...' : '신청'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={leaves}
        isLoading={isLoading}
        pageSize={50}
      />
    </div>
  )
}
