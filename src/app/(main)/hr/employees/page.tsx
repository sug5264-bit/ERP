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
import { formatDate, formatPhone } from '@/lib/format'
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export'
import { ExcelImportDialog } from '@/components/common/excel-import-dialog'
import type { TemplateColumn } from '@/lib/export'
import { toast } from 'sonner'
import { Upload, Trash2 } from 'lucide-react'

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
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.employeeNo}</span>
    ),
  },
  {
    accessorKey: 'nameKo',
    header: '이름',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.nameKo}</div>
        {row.original.nameEn && (
          <div className="text-xs text-muted-foreground">{row.original.nameEn}</div>
        )}
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
    cell: ({ row }) => row.original.phone ? formatPhone(row.original.phone) : '-',
  },
]

export default function EmployeesPage() {
  const [open, setOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const queryClient = useQueryClient()

  const queryParams = new URLSearchParams({ pageSize: '100' })
  if (statusFilter && statusFilter !== 'all') queryParams.set('status', statusFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['hr-employees', statusFilter],
    queryFn: () => api.get(`/hr/employees?${queryParams.toString()}`) as Promise<any>,
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
    mutationFn: (body: any) => api.post('/hr/employees', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] })
      setOpen(false)
      toast.success('사원이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/employees/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-employees'] }); toast.success('사원이 삭제되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`사원 [${name}]을(를) 삭제하시겠습니까?`)) deleteMutation.mutate(id)
  }

  const employees: EmployeeRow[] = data?.data || []
  const departments = deptData?.data || []
  const positions = posData?.data || []

  const exportColumns: ExportColumn[] = [
    { header: '사번', accessor: 'employeeNo' },
    { header: '이름', accessor: 'nameKo' },
    { header: '부서', accessor: (r) => r.department?.name || '' },
    { header: '직급', accessor: (r) => r.position?.name || '' },
    { header: '고용형태', accessor: (r) => TYPE_MAP[r.employeeType] || r.employeeType },
    { header: '상태', accessor: (r) => STATUS_MAP[r.status]?.label || r.status },
    { header: '입사일', accessor: (r) => r.joinDate ? formatDate(r.joinDate) : '' },
    { header: '연락처', accessor: (r) => r.phone || '' },
    { header: '이메일', accessor: (r) => r.email || '' },
  ]

  const importTemplateColumns: TemplateColumn[] = [
    { header: '사번', key: 'employeeNo', example: 'EMP001' },
    { header: '이름', key: 'nameKo', example: '홍길동' },
    { header: '영문이름', key: 'nameEn', example: 'Hong Gildong' },
    { header: '부서', key: 'department', example: '경영지원팀' },
    { header: '직급', key: 'position', example: '사원' },
    { header: '입사일', key: 'joinDate', example: '2026-01-01' },
    { header: '고용형태', key: 'employeeType', example: '정규직' },
    { header: '연락처', key: 'phone', example: '01012345678' },
    { header: '이메일', key: 'email', example: 'hong@company.com' },
  ]

  const importKeyMap: Record<string, string> = {
    '사번': 'employeeNo', '이름': 'nameKo', '영문이름': 'nameEn',
    '부서': 'department', '직급': 'position', '입사일': 'joinDate',
    '고용형태': 'employeeType', '연락처': 'phone', '이메일': 'email',
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="사원관리"
        description="사원 정보를 등록하고 관리합니다"
      />
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="전체 상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="ACTIVE">재직</SelectItem>
            <SelectItem value="ON_LEAVE">휴직</SelectItem>
            <SelectItem value="RESIGNED">퇴직</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" /> 업로드
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>사원 등록</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>신규 사원 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>사번 *</Label>
                  <Input name="employeeNo" required placeholder="EMP001" />
                </div>
                <div className="space-y-2">
                  <Label>이름 (한글) *</Label>
                  <Input name="nameKo" required />
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
                  <Label>부서 *</Label>
                  <Select name="departmentId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>직급 *</Label>
                  <Select name="positionId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="직급 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>입사일 *</Label>
                  <Input name="joinDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label>고용형태 *</Label>
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
                {createMutation.isPending ? '등록 중...' : '등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[...columns, { id: 'delete', header: '', cell: ({ row }: any) => <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(row.original.id, row.original.nameKo)}><Trash2 className="h-4 w-4" /></Button>, size: 50 }]}
        data={employees}
        searchColumn="nameKo"
        searchPlaceholder="이름으로 검색..."
        isLoading={isLoading}
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
    </div>
  )
}
