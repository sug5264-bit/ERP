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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface RecruitmentRow {
  id: string
  title: string
  departmentId: string
  positionId: string
  description: string | null
  requiredCount: number
  status: string
  startDate: string
  endDate: string
  applicants: { id: string; status: string }[]
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  OPEN: { label: '진행중', variant: 'default' },
  CLOSED: { label: '마감', variant: 'secondary' },
}

const APPLICANT_STATUS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  APPLIED: { label: '지원', variant: 'outline' },
  SCREENING: { label: '서류심사', variant: 'secondary' },
  INTERVIEW: { label: '면접', variant: 'default' },
  OFFERED: { label: '합격', variant: 'default' },
  REJECTED: { label: '불합격', variant: 'destructive' },
  HIRED: { label: '입사', variant: 'default' },
}

export default function RecruitmentPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [applicantOpen, setApplicantOpen] = useState(false)
  const [selected, setSelected] = useState<RecruitmentRow | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const queryClient = useQueryClient()

  const qp = new URLSearchParams({ pageSize: '50' })
  if (statusFilter && statusFilter !== 'all') qp.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-recruitment', statusFilter],
    queryFn: () => api.get(`/hr/recruitment?${qp}`) as Promise<any>,
  })

  const { data: deptData } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => api.get('/hr/departments') as Promise<any>,
  })

  const { data: posData } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => api.get('/hr/positions') as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/recruitment', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-recruitment'] })
      setOpen(false)
      toast.success('채용공고가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const actionMutation = useMutation({
    mutationFn: (body: any) => api.put('/hr/recruitment', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-recruitment'] })
      setApplicantOpen(false)
      toast.success('처리되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/recruitment?id=${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-recruitment'] })
      setDetailOpen(false)
      toast.success('삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const recruitments: RecruitmentRow[] = data?.data || []
  const departments = deptData?.data || []
  const positions = posData?.data || []

  const getDeptName = (id: string) => departments.find((d: any) => d.id === id)?.name || '-'
  const getPosName = (id: string) => positions.find((p: any) => p.id === id)?.name || '-'

  const columns: ColumnDef<RecruitmentRow>[] = [
    {
      header: '채용공고명',
      accessorKey: 'title',
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    { header: '부서', cell: ({ row }) => getDeptName(row.original.departmentId) },
    { header: '직급', cell: ({ row }) => getPosName(row.original.positionId) },
    { header: '모집인원', cell: ({ row }) => `${row.original.requiredCount}명` },
    {
      header: '지원자',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{row.original.applicants.length}명</span>
        </div>
      ),
    },
    {
      header: '기간',
      cell: ({ row }) => `${formatDate(row.original.startDate)} ~ ${formatDate(row.original.endDate)}`,
    },
    {
      header: '상태',
      cell: ({ row }) => {
        const s = STATUS_MAP[row.original.status]
        return <Badge variant={s?.variant || 'outline'}>{s?.label || row.original.status}</Badge>
      },
    },
  ]

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      title: form.get('title'),
      departmentId: form.get('departmentId'),
      positionId: form.get('positionId'),
      description: form.get('description') || undefined,
      requiredCount: parseInt(form.get('requiredCount') as string) || 1,
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
    })
  }

  const handleRowClick = (row: any) => {
    setSelected(row)
    setDetailOpen(true)
  }

  const handleAddApplicant = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selected) return
    const form = new FormData(e.currentTarget)
    actionMutation.mutate({
      id: selected.id,
      action: 'addApplicant',
      name: form.get('name'),
      email: form.get('email'),
      phone: form.get('phone') || undefined,
      note: form.get('note') || undefined,
    })
  }

  const handleApplicantStatus = (applicantId: string, status: string) => {
    if (!selected) return
    actionMutation.mutate({
      id: selected.id,
      action: 'updateApplicant',
      applicantId,
      status,
    })
  }

  // 상세보기를 위해 지원자 포함 데이터 다시 조회
  const { data: detailData } = useQuery({
    queryKey: ['hr-recruitment-detail', selected?.id],
    queryFn: () => api.get(`/hr/recruitment/${selected?.id}`) as Promise<any>,
    enabled: !!selected?.id,
  })

  return (
    <div className="space-y-6">
      <PageHeader title="채용관리" description="채용 공고 및 지원자를 관리합니다" />

      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="OPEN">진행중</SelectItem>
            <SelectItem value="CLOSED">마감</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> 채용공고 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>채용공고 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>
                  공고명 <span className="text-destructive">*</span>
                </Label>
                <Input name="title" required aria-required="true" placeholder="채용공고 제목" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    부서 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="departmentId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    직급 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="positionId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="직급 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>모집인원</Label>
                  <Input name="requiredCount" type="number" defaultValue={1} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>
                    시작일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="startDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>
                    종료일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="endDate" type="date" required aria-required="true" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>상세내용</Label>
                <Textarea name="description" rows={4} placeholder="채용 상세 내용" />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '공고 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={recruitments}
        searchColumn="title"
        searchPlaceholder="공고명으로 검색..."
        isLoading={isLoading}
        pageSize={50}
        onRowClick={handleRowClick}
      />

      {/* 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">부서:</span> {getDeptName(selected.departmentId)}
                </div>
                <div>
                  <span className="text-muted-foreground">직급:</span> {getPosName(selected.positionId)}
                </div>
                <div>
                  <span className="text-muted-foreground">모집인원:</span> {selected.requiredCount}명
                </div>
                <div>
                  <span className="text-muted-foreground">상태:</span>{' '}
                  <Badge variant={STATUS_MAP[selected.status]?.variant || 'outline'}>
                    {STATUS_MAP[selected.status]?.label || selected.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">기간:</span> {formatDate(selected.startDate)} ~{' '}
                  {formatDate(selected.endDate)}
                </div>
              </div>

              {selected.description && (
                <div className="bg-muted/30 rounded-md border p-3 text-sm whitespace-pre-wrap">
                  {selected.description}
                </div>
              )}

              {/* 지원자 목록 */}
              <div className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">지원자 ({selected.applicants.length}명)</h4>
                  {selected.status === 'OPEN' && (
                    <Dialog open={applicantOpen} onOpenChange={setApplicantOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserPlus className="mr-1 h-3 w-3" /> 지원자 추가
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>지원자 추가</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddApplicant} className="space-y-4">
                          <div className="space-y-2">
                            <Label>
                              이름 <span className="text-destructive">*</span>
                            </Label>
                            <Input name="name" required aria-required="true" />
                          </div>
                          <div className="space-y-2">
                            <Label>
                              이메일 <span className="text-destructive">*</span>
                            </Label>
                            <Input name="email" type="email" required aria-required="true" />
                          </div>
                          <div className="space-y-2">
                            <Label>연락처</Label>
                            <Input name="phone" placeholder="010-0000-0000" />
                          </div>
                          <div className="space-y-2">
                            <Label>비고</Label>
                            <Input name="note" placeholder="메모" />
                          </div>
                          <Button type="submit" className="w-full" disabled={actionMutation.isPending}>
                            {actionMutation.isPending ? '추가 중...' : '추가'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {selected.applicants.length === 0 ? (
                  <p className="text-muted-foreground text-sm">지원자가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.applicants.map((app: any) => (
                      <div key={app.id} className="flex items-center gap-2 border-b pb-2 text-sm last:border-0">
                        <span className="flex-1 font-medium">{app.name || app.id}</span>
                        <Badge variant={APPLICANT_STATUS[app.status]?.variant || 'outline'}>
                          {APPLICANT_STATUS[app.status]?.label || app.status}
                        </Badge>
                        <Select value={app.status} onValueChange={(v) => handleApplicantStatus(app.id, v)}>
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(APPLICANT_STATUS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {selected.status === 'OPEN' && (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      actionMutation.mutate({ id: selected.id, action: 'close' })
                      setDetailOpen(false)
                    }}
                  >
                    마감 처리
                  </Button>
                )}
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="mr-1 h-3 w-3" /> 삭제
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="채용공고 삭제"
        description="채용공고를 삭제하시겠습니까? 지원자 데이터도 함께 삭제됩니다."
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (selected) deleteMutation.mutate(selected.id)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
