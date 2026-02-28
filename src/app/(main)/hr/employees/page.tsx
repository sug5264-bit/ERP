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
import { formatDate, formatPhone } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { ExcelImportDialog } from '@/components/common/excel-import-dialog'
import type { TemplateColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Upload, Trash2, Pencil } from 'lucide-react'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface EmployeeRow {
  id: string
  employeeNo: string
  nameKo: string
  nameEn: string | null
  employeeType: string
  status: string
  joinDate: string
  resignDate: string | null
  phone: string | null
  email: string | null
  department: { id: string; name: string } | null
  position: { id: string; name: string } | null
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  ACTIVE: { label: '재직', variant: 'default' },
  ON_LEAVE: { label: '휴직', variant: 'secondary' },
  RESIGNED: { label: '퇴직', variant: 'destructive' },
}

const TYPE_MAP: Record<string, string> = {
  REGULAR: '정규직',
  CONTRACT: '계약직',
  DISPATCH: '파견직',
  INTERN: '인턴',
}

const columns: ColumnDef<EmployeeRow>[] = [
  {
    accessorKey: 'employeeNo',
    header: '사번',
    cell: ({ row }) => <span className="font-mono text-sm">{row.original.employeeNo}</span>,
  },
  {
    accessorKey: 'nameKo',
    header: '이름',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.nameKo}</div>
        {row.original.nameEn && <div className="text-muted-foreground text-xs">{row.original.nameEn}</div>}
      </div>
    ),
  },
  {
    id: 'department',
    header: '부서',
    cell: ({ row }) => row.original.department?.name || '-',
  },
  {
    id: 'position',
    header: '직급',
    cell: ({ row }) => row.original.position?.name || '-',
  },
  {
    id: 'employeeType',
    header: '고용형태',
    cell: ({ row }) => TYPE_MAP[row.original.employeeType] || row.original.employeeType,
  },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => {
      const s = STATUS_MAP[row.original.status]
      return s ? <Badge variant={s.variant}>{s.label}</Badge> : row.original.status
    },
  },
  {
    accessorKey: 'joinDate',
    header: '입사일',
    cell: ({ row }) => formatDate(row.original.joinDate),
  },
  {
    id: 'phone',
    header: '연락처',
    cell: ({ row }) => (row.original.phone ? formatPhone(row.original.phone) : '-'),
  },
]

export default function EmployeesPage() {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [deptFilter, setDeptFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [joinDateFrom, setJoinDateFrom] = useState('')
  const [joinDateTo, setJoinDateTo] = useState('')
  const queryClient = useQueryClient()

  const queryParams = new URLSearchParams({ pageSize: '100' })
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter)
  if (deptFilter && deptFilter !== 'all') queryParams.set('departmentId', deptFilter)
  if (typeFilter && typeFilter !== 'all') queryParams.set('employeeType', typeFilter)
  if (joinDateFrom) queryParams.set('joinDateFrom', joinDateFrom)
  if (joinDateTo) queryParams.set('joinDateTo', joinDateTo)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['hr-employees', statusFilter, deptFilter, typeFilter, joinDateFrom, joinDateTo],
    queryFn: () => api.get(`/hr/employees?${queryParams.toString()}`) as Promise<{ data: EmployeeRow[] }>,
  })

  const { data: deptData } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => api.get('/hr/departments') as Promise<{ data: { id: string; name: string }[] }>,
    staleTime: 30 * 60 * 1000,
  })

  const { data: posData } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => api.get('/hr/positions') as Promise<{ data: { id: string; name: string }[] }>,
    staleTime: 30 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/hr/employees', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] })
      setOpen(false)
      toast.success('사원이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; [key: string]: unknown }) => api.put(`/hr/employees/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] })
      setEditTarget(null)
      toast.success('사원 정보가 수정되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] })
      toast.success('사원이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name })
  }

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editTarget) return
    const form = new FormData(e.currentTarget)
    updateMutation.mutate({
      id: editTarget.id,
      nameKo: form.get('nameKo'),
      nameEn: form.get('nameEn') || undefined,
      departmentId: form.get('departmentId'),
      positionId: form.get('positionId'),
      joinDate: form.get('joinDate'),
      employeeType: form.get('employeeType'),
      status: form.get('status'),
      resignDate: form.get('resignDate') || null,
      email: form.get('email') || undefined,
      phone: form.get('phone') || undefined,
    })
  }

  const employees: EmployeeRow[] = data?.data || []
  const departments: { id: string; name: string }[] = deptData?.data || []
  const positions: { id: string; name: string }[] = posData?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '사번', accessor: 'employeeNo' },
    { header: '이름', accessor: 'nameKo' },
    { header: '부서', accessor: (r) => r.department?.name || '' },
    { header: '직급', accessor: (r) => r.position?.name || '' },
    { header: '고용형태', accessor: (r) => TYPE_MAP[r.employeeType] || r.employeeType },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
    { header: '입사일', accessor: (r) => (r.joinDate ? formatDate(r.joinDate) : '') },
    { header: '연락처', accessor: (r) => r.phone || '' },
    { header: '이메일', accessor: (r) => r.email || '' },
  ]

  const importTemplateColumns: TemplateColumn[] = [
    { header: '사번', key: 'employeeNo', example: 'EMP001', required: true },
    { header: '이름', key: 'nameKo', example: '홍길동', required: true },
    { header: '영문이름', key: 'nameEn', example: 'Hong Gildong' },
    { header: '부서', key: 'department', example: '경영지원팀', required: true },
    { header: '직급', key: 'position', example: '사원', required: true },
    { header: '입사일', key: 'joinDate', example: '2026-01-01' },
    { header: '고용형태', key: 'employeeType', example: '정규직' },
    { header: '연락처', key: 'phone', example: '01012345678' },
    { header: '이메일', key: 'email', example: 'hong@company.com' },
  ]

  const importKeyMap: Record<string, string> = {
    사번: 'employeeNo',
    이름: 'nameKo',
    영문이름: 'nameEn',
    부서: 'department',
    직급: 'position',
    입사일: 'joinDate',
    고용형태: 'employeeType',
    연락처: 'phone',
    이메일: 'email',
  }

  const handleExport = (type: 'excel' | 'pdf') => {
    const cfg = { fileName: '사원목록', title: '사원관리 목록', columns: exportColumns, data: employees }
    if (type === 'excel') exportToExcel(cfg)
    else exportToPDF(cfg)
    toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} 파일이 다운로드되었습니다.`)
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      employeeNo: form.get('employeeNo'),
      nameKo: form.get('nameKo'),
      nameEn: form.get('nameEn') || undefined,
      departmentId: form.get('departmentId'),
      positionId: form.get('positionId'),
      joinDate: form.get('joinDate'),
      employeeType: form.get('employeeType'),
      email: form.get('email') || undefined,
      phone: form.get('phone') || undefined,
      gender: form.get('gender') || undefined,
      birthDate: form.get('birthDate') || undefined,
    })
  }

  // 요약 통계
  const empSummary = {
    total: employees.length,
    active: employees.filter((e: EmployeeRow) => e.status === 'ACTIVE').length,
    onLeave: employees.filter((e: EmployeeRow) => e.status === 'ON_LEAVE').length,
    resigned: employees.filter((e: EmployeeRow) => e.status === 'RESIGNED').length,
  }

  return (
    <div className="space-y-6">
      <PageHeader title="사원관리" description="사원 정보를 등록하고 관리합니다" />

      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="bg-muted/30 rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">전체</p>
          <p className="mt-0.5 text-sm font-bold sm:text-lg">{empSummary.total}명</p>
        </div>
        <div className="bg-status-success-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">재직</p>
          <p className="text-status-success mt-0.5 text-sm font-bold sm:text-lg">{empSummary.active}명</p>
        </div>
        <div className="bg-status-warning-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">휴직</p>
          <p className="text-status-warning mt-0.5 text-sm font-bold sm:text-lg">{empSummary.onLeave}명</p>
        </div>
        <div className="bg-status-danger-muted rounded-lg border p-3 text-center sm:p-4">
          <p className="text-muted-foreground text-[10px] sm:text-xs">퇴직</p>
          <p className="text-status-danger mt-0.5 text-sm font-bold sm:text-lg">{empSummary.resigned}명</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="ACTIVE">재직</SelectItem>
            <SelectItem value="ON_LEAVE">휴직</SelectItem>
            <SelectItem value="RESIGNED">퇴직</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="전체 부서" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 부서</SelectItem>
            {departments.map((d: { id: string; name: string }) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue placeholder="전체 유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            {Object.entries(TYPE_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="w-full sm:w-36"
            value={joinDateFrom}
            onChange={(e) => setJoinDateFrom(e.target.value)}
            placeholder="입사일 시작"
          />
          <span className="text-muted-foreground text-xs">~</span>
          <Input
            type="date"
            className="w-full sm:w-36"
            value={joinDateTo}
            onChange={(e) => setJoinDateTo(e.target.value)}
            placeholder="입사일 종료"
          />
        </div>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> 업로드
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>사원 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>신규 사원 등록</DialogTitle>
              <p className="text-muted-foreground text-xs">
                <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
              </p>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    사번 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="employeeNo" required aria-required="true" placeholder="EMP001" />
                </div>
                <div className="space-y-2">
                  <Label>
                    이름 (한글) <span className="text-destructive">*</span>
                  </Label>
                  <Input name="nameKo" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>이름 (영문)</Label>
                  <Input name="nameEn" />
                </div>
                <div className="space-y-2">
                  <Label>이메일</Label>
                  <Input name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>
                    부서 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="departmentId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d: { id: string; name: string }) => (
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
                      {positions.map((p: { id: string; name: string }) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    입사일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="joinDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>
                    고용형태 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="employeeType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">정규직</SelectItem>
                      <SelectItem value="CONTRACT">계약직</SelectItem>
                      <SelectItem value="DISPATCH">파견직</SelectItem>
                      <SelectItem value="INTERN">인턴</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>연락처</Label>
                  <Input name="phone" placeholder="01012345678" />
                </div>
                <div className="space-y-2">
                  <Label>성별</Label>
                  <Select name="gender">
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">남성</SelectItem>
                      <SelectItem value="F">여성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>생년월일</Label>
                  <Input name="birthDate" type="date" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '사원 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[
          ...columns,
          {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditTarget(row.original as EmployeeRow)}
                  aria-label="수정"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive h-8 w-8"
                  onClick={() => handleDelete((row.original as EmployeeRow).id, (row.original as EmployeeRow).nameKo)}
                  aria-label="삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
            size: 80,
          },
        ]}
        data={employees}
        searchColumn="nameKo"
        searchPlaceholder="이름으로 검색..."
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onExport={{ excel: () => handleExport('excel'), pdf: () => handleExport('pdf') }}
      />
      <ExcelImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="사원 대량등록"
        apiEndpoint="/hr/employees/import"
        templateColumns={importTemplateColumns}
        templateFileName="사원_업로드_템플릿"
        keyMap={importKeyMap}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['hr-employees'] })}
      />
      <Dialog open={!!editTarget} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>사원 정보 수정</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form key={editTarget.id} onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>사번</Label>
                  <Input value={editTarget.employeeNo} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>
                    이름 (한글) <span className="text-destructive">*</span>
                  </Label>
                  <Input name="nameKo" required aria-required="true" defaultValue={editTarget.nameKo} />
                </div>
                <div className="space-y-2">
                  <Label>이름 (영문)</Label>
                  <Input name="nameEn" defaultValue={editTarget.nameEn || ''} />
                </div>
                <div className="space-y-2">
                  <Label>이메일</Label>
                  <Input name="email" type="email" defaultValue={editTarget.email || ''} />
                </div>
                <div className="space-y-2">
                  <Label>
                    부서 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="departmentId" required defaultValue={editTarget.department?.id}>
                    <SelectTrigger>
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d: { id: string; name: string }) => (
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
                  <Select name="positionId" required defaultValue={editTarget.position?.id}>
                    <SelectTrigger>
                      <SelectValue placeholder="직급 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p: { id: string; name: string }) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    입사일 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    name="joinDate"
                    type="date"
                    required
                    aria-required="true"
                    defaultValue={editTarget.joinDate?.split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    고용형태 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="employeeType" required defaultValue={editTarget.employeeType}>
                    <SelectTrigger>
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REGULAR">정규직</SelectItem>
                      <SelectItem value="CONTRACT">계약직</SelectItem>
                      <SelectItem value="DISPATCH">파견직</SelectItem>
                      <SelectItem value="INTERN">인턴</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>상태</Label>
                  <Select name="status" defaultValue={editTarget.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">재직</SelectItem>
                      <SelectItem value="ON_LEAVE">휴직</SelectItem>
                      <SelectItem value="RESIGNED">퇴직</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>퇴직일</Label>
                  <Input name="resignDate" type="date" defaultValue={editTarget.resignDate?.split('T')[0] || ''} />
                </div>
                <div className="space-y-2">
                  <Label>연락처</Label>
                  <Input name="phone" defaultValue={editTarget.phone || ''} placeholder="01012345678" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '수정 중...' : '수정'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="사원 삭제"
        description={`사원 [${deleteTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
