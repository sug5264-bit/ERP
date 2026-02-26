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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatDate, formatCurrency } from '@/lib/format'
import { toast } from 'sonner'
import { Plus, Users, ListTodo } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PLANNING: { label: '계획', variant: 'secondary' },
  IN_PROGRESS: { label: '진행중', variant: 'default' },
  ON_HOLD: { label: '보류', variant: 'outline' },
  COMPLETED: { label: '완료', variant: 'secondary' },
  CANCELLED: { label: '취소', variant: 'destructive' },
}

const TASK_STATUS: Record<string, string> = {
  WAITING: '대기',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
}
const PRIORITY_MAP: Record<string, string> = { URGENT: '긴급', HIGH: '높음', NORMAL: '보통', LOW: '낮음' }

const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'projectCode',
    header: '코드',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.projectCode}</span>,
  },
  { accessorKey: 'projectName', header: '프로젝트명' },
  { id: 'department', header: '부서', cell: ({ row }) => row.original.department?.name || '-' },
  {
    id: 'period',
    header: '기간',
    cell: ({ row }) =>
      `${formatDate(row.original.startDate)} ~ ${row.original.endDate ? formatDate(row.original.endDate) : '미정'}`,
  },
  {
    id: 'progress',
    header: '진행률',
    cell: ({ row }) => (
      <div className="flex w-32 items-center gap-2">
        <Progress value={Number(row.original.progress)} className="h-2" />
        <span className="text-xs">{Number(row.original.progress)}%</span>
      </div>
    ),
  },
  {
    id: 'members',
    header: '인원',
    cell: ({ row }) => <span className="text-sm">{row.original.members?.length || 0}명</span>,
  },
  {
    id: 'status',
    header: '상태',
    cell: ({ row }) => {
      const s = STATUS_MAP[row.original.status]
      return <Badge variant={s?.variant || 'outline'}>{s?.label || row.original.status}</Badge>
    },
  },
]

export default function ProjectsPage() {
  const [open, setOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [taskOpen, setTaskOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects?pageSize=50') as Promise<any>,
  })
  const { data: deptData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/hr/departments') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })
  const { data: empData } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/hr/employees?pageSize=500') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const departments = deptData?.data || []
  const employees = empData?.data || []

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/projects', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setOpen(false)
      toast.success('프로젝트가 생성되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const taskMutation = useMutation({
    mutationFn: ({ projectId, body }: { projectId: string; body: any }) =>
      api.post(`/projects/${projectId}/tasks`, body),
    onSuccess: () => {
      refreshDetail()
      setTaskOpen(false)
      toast.success('작업이 추가되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const memberMutation = useMutation({
    mutationFn: ({ projectId, body }: { projectId: string; body: any }) =>
      api.post(`/projects/${projectId}/members`, body),
    onSuccess: () => {
      refreshDetail()
      setMemberOpen(false)
      toast.success('멤버가 추가되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const refreshDetail = async () => {
    if (selectedProject) {
      const res = (await api.get(`/projects/${selectedProject.id}`)) as any
      setSelectedProject(res.data || res)
    }
  }

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      projectCode: form.get('projectCode'),
      projectName: form.get('projectName'),
      managerId: form.get('managerId'),
      departmentId: form.get('departmentId'),
      startDate: form.get('startDate'),
      endDate: form.get('endDate') || undefined,
      budget: form.get('budget') ? Number(form.get('budget')) : undefined,
      description: form.get('description') || undefined,
    })
  }

  const handleRowClick = async (row: any) => {
    try {
      const res = (await api.get(`/projects/${row.id}`)) as any
      const data = res.data || res
      if (data) {
        setSelectedProject(data)
        setDetailOpen(true)
      }
    } catch {
      toast.error('프로젝트를 불러올 수 없습니다.')
    }
  }

  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    taskMutation.mutate({
      projectId: selectedProject.id,
      body: {
        taskName: form.get('taskName'),
        assigneeId: form.get('assigneeId') || undefined,
        startDate: form.get('startDate') || undefined,
        endDate: form.get('endDate') || undefined,
        priority: form.get('priority') || 'NORMAL',
        estimatedHours: form.get('estimatedHours') ? Number(form.get('estimatedHours')) : undefined,
      },
    })
  }

  const handleAddMember = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    memberMutation.mutate({
      projectId: selectedProject.id,
      body: { employeeId: form.get('employeeId'), role: form.get('role') || 'MEMBER' },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="프로젝트 관리" description="프로젝트를 생성하고 작업/멤버를 관리합니다" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>프로젝트 생성</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>프로젝트 생성</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    프로젝트 코드 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="projectCode" required aria-required="true" placeholder="PRJ-001" />
                </div>
                <div className="space-y-2">
                  <Label>
                    프로젝트명 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="projectName" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>
                    담당부서 <span className="text-destructive">*</span>
                  </Label>
                  <Select name="departmentId">
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
                    PM <span className="text-destructive">*</span>
                  </Label>
                  <Select name="managerId">
                    <SelectTrigger>
                      <SelectValue placeholder="PM 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.nameKo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    시작일 <span className="text-destructive">*</span>
                  </Label>
                  <Input name="startDate" type="date" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>종료일</Label>
                  <Input name="endDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label>예산</Label>
                  <Input name="budget" type="number" placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>프로젝트 설명</Label>
                <Textarea name="description" rows={3} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '생성 중...' : '프로젝트 생성'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={data?.data || []}
        searchColumn="projectName"
        searchPlaceholder="프로젝트명 검색..."
        isLoading={isLoading}
        pageSize={50}
        onRowClick={handleRowClick}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-2xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedProject?.projectName}</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">상태</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={STATUS_MAP[selectedProject.status]?.variant || 'outline'}>
                      {STATUS_MAP[selectedProject.status]?.label}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">진행률</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Progress value={Number(selectedProject.progress)} className="h-2 flex-1" />
                      <span className="text-sm font-bold">{Number(selectedProject.progress)}%</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">멤버</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-xl font-bold">{selectedProject.members?.length || 0}명</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-muted-foreground text-xs">예산</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm font-bold">
                      {selectedProject.budget ? formatCurrency(Number(selectedProject.budget)) : '-'}
                    </span>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="tasks">
                <TabsList>
                  <TabsTrigger value="tasks">
                    <ListTodo className="mr-1 h-4 w-4" /> 작업 ({selectedProject.tasks?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="members">
                    <Users className="mr-1 h-4 w-4" /> 멤버 ({selectedProject.members?.length || 0})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="tasks" className="space-y-3">
                  <Button size="sm" variant="outline" onClick={() => setTaskOpen(true)}>
                    <Plus className="mr-1 h-3 w-3" /> 작업 추가
                  </Button>
                  {(selectedProject.tasks || []).length === 0 ? (
                    <p className="text-muted-foreground p-4 text-center text-sm">등록된 작업이 없습니다.</p>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {(selectedProject.tasks || []).map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 text-sm">
                          <div className="flex-1">
                            <span className="font-medium">{t.taskName}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {PRIORITY_MAP[t.priority] || t.priority}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex w-24 items-center gap-1">
                              <Progress value={Number(t.progress)} className="h-1.5" />
                              <span className="text-xs">{Number(t.progress)}%</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {TASK_STATUS[t.status] || t.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="members" className="space-y-3">
                  <Button size="sm" variant="outline" onClick={() => setMemberOpen(true)}>
                    <Plus className="mr-1 h-3 w-3" /> 멤버 추가
                  </Button>
                  {(selectedProject.members || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8">
                      <Users className="text-muted-foreground/30 h-8 w-8" />
                      <p className="text-muted-foreground text-sm">등록된 멤버가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="divide-y rounded-md border">
                      {(selectedProject.members || []).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between p-3 text-sm">
                          <span>{m.employee?.nameKo || '-'}</span>
                          <Badge variant="outline">
                            {m.role === 'PM' ? 'PM' : m.role === 'REVIEWER' ? '검토자' : '멤버'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>작업 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label>
                작업명 <span className="text-destructive">*</span>
              </Label>
              <Input name="taskName" required aria-required="true" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>담당자</Label>
                <Select name="assigneeId">
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nameKo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>우선순위</Label>
                <Select name="priority" defaultValue="NORMAL">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="URGENT">긴급</SelectItem>
                    <SelectItem value="HIGH">높음</SelectItem>
                    <SelectItem value="NORMAL">보통</SelectItem>
                    <SelectItem value="LOW">낮음</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input name="startDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input name="endDate" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>예상시간 (h)</Label>
              <Input name="estimatedHours" type="number" />
            </div>
            <Button type="submit" className="w-full" disabled={taskMutation.isPending}>
              작업 추가
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>멤버 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-2">
              <Label>
                사원 <span className="text-destructive">*</span>
              </Label>
              <Select name="employeeId">
                <SelectTrigger>
                  <SelectValue placeholder="사원 선택" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nameKo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>역할</Label>
              <Select name="role" defaultValue="MEMBER">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PM">PM</SelectItem>
                  <SelectItem value="MEMBER">멤버</SelectItem>
                  <SelectItem value="REVIEWER">검토자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={memberMutation.isPending}>
              멤버 추가
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
