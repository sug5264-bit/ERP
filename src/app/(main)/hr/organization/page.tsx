'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, Users, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'

interface Department {
  id: string
  code: string
  name: string
  level: number
  isActive: boolean
  sortOrder: number
  parentId: string | null
  parent: { name: string } | null
  _count: { employees: number }
}

interface Position {
  id: string
  code: string
  name: string
  level: number
  isActive: boolean
  sortOrder: number
  _count: { employees: number }
}

export default function OrganizationPage() {
  const [deptOpen, setDeptOpen] = useState(false)
  const [posOpen, setPosOpen] = useState(false)
  const [deleteDeptTarget, setDeleteDeptTarget] = useState<{ id: string; name: string } | null>(null)
  const [deletePosTarget, setDeletePosTarget] = useState<{ id: string; name: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: deptData, isLoading: deptLoading } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => api.get('/hr/departments') as Promise<any>,
  })

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => api.get('/hr/positions') as Promise<any>,
  })

  const createDeptMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/departments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] })
      setDeptOpen(false)
      toast.success('부서가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createPosMutation = useMutation({
    mutationFn: (body: any) => api.post('/hr/positions', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-positions'] })
      setPosOpen(false)
      toast.success('직급이 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-departments'] })
      toast.success('부서가 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deletePosMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-positions'] })
      toast.success('직급이 삭제되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const departments: Department[] = deptData?.data || []
  const positions: Position[] = posData?.data || []

  const handleCreateDept = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const parentId = form.get('parentId') as string
    createDeptMutation.mutate({
      code: form.get('code'),
      name: form.get('name'),
      parentId: parentId && parentId !== 'none' ? parentId : null,
      sortOrder: parseInt(form.get('sortOrder') as string) || 0,
    })
  }

  const handleCreatePos = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createPosMutation.mutate({
      code: form.get('code'),
      name: form.get('name'),
      level: parseInt(form.get('level') as string) || 1,
      sortOrder: parseInt(form.get('sortOrder') as string) || 0,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="부서/직급" description="조직의 부서와 직급을 관리합니다" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>부서 관리</CardTitle>
            </div>
            <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
              <DialogTrigger asChild>
                <Button size="sm">부서 추가</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>부서 등록</DialogTitle>
                  <p className="text-muted-foreground text-xs">
                    <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
                  </p>
                </DialogHeader>
                <form onSubmit={handleCreateDept} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        부서코드 <span className="text-destructive">*</span>
                      </Label>
                      <Input name="code" required aria-required="true" placeholder="DIV-001" />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        부서명 <span className="text-destructive">*</span>
                      </Label>
                      <Input name="name" required aria-required="true" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>상위부서</Label>
                    <Select name="parentId">
                      <SelectTrigger>
                        <SelectValue placeholder="없음 (최상위)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">없음 (최상위)</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {'─'.repeat(d.level)} {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>정렬순서</Label>
                    <Input name="sortOrder" type="number" defaultValue={0} />
                  </div>
                  <Button type="submit" className="w-full" disabled={createDeptMutation.isPending}>
                    {createDeptMutation.isPending ? '등록 중...' : '부서 등록'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {deptLoading ? (
              <p className="text-muted-foreground text-center text-sm">로딩 중...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>부서명</TableHead>
                    <TableHead>코드</TableHead>
                    <TableHead>인원</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {dept.level > 1 && (
                            <span className="text-muted-foreground">
                              {'　'.repeat(dept.level - 1)}
                              <ChevronRight className="inline h-3 w-3" />
                            </span>
                          )}
                          <span className="font-medium">{dept.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{dept.code}</TableCell>
                      <TableCell>{dept._count.employees}명</TableCell>
                      <TableCell>
                        <Badge variant={dept.isActive ? 'default' : 'destructive'}>
                          {dept.isActive ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => setDeleteDeptTarget({ id: dept.id, name: dept.name })}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {departments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center">
                        등록된 부서가 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>직급 관리</CardTitle>
            </div>
            <Dialog open={posOpen} onOpenChange={setPosOpen}>
              <DialogTrigger asChild>
                <Button size="sm">직급 추가</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>직급 등록</DialogTitle>
                  <p className="text-muted-foreground text-xs">
                    <span className="text-destructive">*</span> 표시는 필수 입력 항목입니다
                  </p>
                </DialogHeader>
                <form onSubmit={handleCreatePos} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        직급코드 <span className="text-destructive">*</span>
                      </Label>
                      <Input name="code" required aria-required="true" placeholder="POS-001" />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        직급명 <span className="text-destructive">*</span>
                      </Label>
                      <Input name="name" required aria-required="true" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        레벨 <span className="text-destructive">*</span>
                      </Label>
                      <Input name="level" type="number" required aria-required="true" defaultValue={1} min={1} />
                    </div>
                    <div className="space-y-2">
                      <Label>정렬순서</Label>
                      <Input name="sortOrder" type="number" defaultValue={0} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={createPosMutation.isPending}>
                    {createPosMutation.isPending ? '등록 중...' : '직급 등록'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {posLoading ? (
              <p className="text-muted-foreground text-center text-sm">로딩 중...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>직급명</TableHead>
                    <TableHead>코드</TableHead>
                    <TableHead>레벨</TableHead>
                    <TableHead>인원</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos) => (
                    <TableRow key={pos.id}>
                      <TableCell className="font-medium">{pos.name}</TableCell>
                      <TableCell className="font-mono text-xs">{pos.code}</TableCell>
                      <TableCell>{pos.level}</TableCell>
                      <TableCell>{pos._count.employees}명</TableCell>
                      <TableCell>
                        <Badge variant={pos.isActive ? 'default' : 'destructive'}>
                          {pos.isActive ? '활성' : '비활성'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          onClick={() => setDeletePosTarget({ id: pos.id, name: pos.name })}
                          aria-label="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {positions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground text-center">
                        등록된 직급이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteDeptTarget}
        onOpenChange={(open) => !open && setDeleteDeptTarget(null)}
        title="부서 삭제"
        description={`부서 [${deleteDeptTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deleteDeptTarget) deleteDeptMutation.mutate(deleteDeptTarget.id)
        }}
        isPending={deleteDeptMutation.isPending}
      />

      <ConfirmDialog
        open={!!deletePosTarget}
        onOpenChange={(open) => !open && setDeletePosTarget(null)}
        title="직급 삭제"
        description={`직급 [${deletePosTarget?.name}]을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={() => {
          if (deletePosTarget) deletePosMutation.mutate(deletePosTarget.id)
        }}
        isPending={deletePosMutation.isPending}
      />
    </div>
  )
}
