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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'

interface RoleItem {
  id: string
  name: string
  description: string | null
}

interface DepartmentItem {
  id: string
  name: string
}

interface PositionItem {
  id: string
  name: string
}

interface UserRow {
  id: string
  username: string
  email: string
  name: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  roles: RoleItem[]
  employee: {
    id: string
    employeeNo: string
    nameKo: string
    departmentId: string | null
    positionId: string | null
    department: { id: string; name: string } | null
    position: { id: string; name: string } | null
  } | null
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)

  // Form state
  const [formUsername, setFormUsername] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formIsActive, setFormIsActive] = useState(true)
  const [formRoleIds, setFormRoleIds] = useState<string[]>([])
  const [formDepartmentId, setFormDepartmentId] = useState('')
  const [formPositionId, setFormPositionId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users?pageSize=100') as Promise<any>,
  })

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/admin/roles?pageSize=100') as Promise<any>,
  })

  const { data: departmentsData } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: () => api.get('/hr/departments?pageSize=100') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const { data: positionsData } = useQuery({
    queryKey: ['hr-positions'],
    queryFn: () => api.get('/hr/positions?pageSize=100') as Promise<any>,
    staleTime: 5 * 60 * 1000,
  })

  const roles: RoleItem[] = rolesData?.data || []
  const users: UserRow[] = data?.data || []
  const departments: DepartmentItem[] = departmentsData?.data || []
  const positions: PositionItem[] = positionsData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setCreateOpen(false)
      resetForm()
      toast.success('사용자가 생성되었습니다.')
    },
    onError: (err: any) => {
      toast.error(err?.message || '사용자 생성에 실패했습니다.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/admin/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditOpen(false)
      setSelectedUser(null)
      resetForm()
      toast.success('사용자 정보가 수정되었습니다.')
    },
    onError: (err: any) => {
      toast.error(err?.message || '사용자 수정에 실패했습니다.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setDeleteOpen(false)
      setSelectedUser(null)
      toast.success('사용자가 삭제되었습니다.')
    },
    onError: (err: any) => {
      toast.error(err?.message || '사용자 삭제에 실패했습니다.')
    },
  })

  const resetForm = () => {
    setFormUsername('')
    setFormEmail('')
    setFormName('')
    setFormPassword('')
    setFormIsActive(true)
    setFormRoleIds([])
    setFormDepartmentId('')
    setFormPositionId('')
  }

  const openCreate = () => {
    resetForm()
    setCreateOpen(true)
  }

  const openEdit = (user: UserRow) => {
    setSelectedUser(user)
    setFormUsername(user.username)
    setFormEmail(user.email)
    setFormName(user.name)
    setFormPassword('')
    setFormIsActive(user.isActive)
    setFormRoleIds(user.roles.map((r) => r.id))
    setFormDepartmentId(user.employee?.departmentId || '')
    setFormPositionId(user.employee?.positionId || '')
    setEditOpen(true)
  }

  const openDelete = (user: UserRow) => {
    setSelectedUser(user)
    setDeleteOpen(true)
  }

  const handleCreate = () => {
    if (!formUsername || !formEmail || !formName || !formPassword || formRoleIds.length === 0) {
      toast.error('모든 필수 항목을 입력하세요.')
      return
    }
    createMutation.mutate({
      username: formUsername,
      email: formEmail,
      name: formName,
      password: formPassword,
      roleIds: formRoleIds,
    })
  }

  const handleUpdate = () => {
    if (!selectedUser) return
    const data: any = {
      username: formUsername,
      email: formEmail,
      name: formName,
      isActive: formIsActive,
      roleIds: formRoleIds,
    }
    if (formPassword) data.password = formPassword
    if (formDepartmentId) data.departmentId = formDepartmentId
    if (formPositionId) data.positionId = formPositionId
    updateMutation.mutate({ id: selectedUser.id, data })
  }

  const handleDelete = () => {
    if (!selectedUser) return
    deleteMutation.mutate(selectedUser.id)
  }

  const toggleRole = (roleId: string) => {
    setFormRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'username',
      header: '아이디',
    },
    {
      accessorKey: 'name',
      header: '이름',
    },
    {
      accessorKey: 'email',
      header: '이메일',
    },
    {
      id: 'department',
      header: '소속',
      cell: ({ row }) => {
        const emp = row.original.employee
        return emp ? `${emp.department?.name || ''} / ${emp.position?.name || ''}` : '-'
      },
    },
    {
      id: 'roles',
      header: '역할',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((r) => (
            <Badge key={r.id} variant="secondary" className="text-xs">
              {r.description || r.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: '상태',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'default' : 'destructive'}>
          {row.original.isActive ? '활성' : '비활성'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: '최종 로그인',
      cell: ({ row }) =>
        row.original.lastLoginAt
          ? formatDateTime(row.original.lastLoginAt)
          : '-',
    },
    {
      id: 'actions',
      header: '관리',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="수정"
            onClick={(e) => {
              e.stopPropagation()
              openEdit(row.original)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="삭제"
            onClick={(e) => {
              e.stopPropagation()
              openDelete(row.original)
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="사용자관리"
        description="시스템 사용자 계정을 관리합니다"
      />
      <div className="flex justify-end">
        <Button onClick={openCreate}>사용자 추가</Button>
      </div>
      <DataTable
        columns={columns}
        data={users}
        searchColumn="name"
        searchPlaceholder="이름으로 검색..."
        isLoading={isLoading}
      />

      {/* 생성 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>사용자 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>아이디 *</Label>
              <Input
                placeholder="영문, 숫자, 점, 밑줄"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input
                placeholder="이름"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>이메일 *</Label>
              <Input
                type="email"
                placeholder="user@erp.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>비밀번호 *</Label>
              <Input
                type="password"
                placeholder="6자 이상"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>역할 *</Label>
              <div className="space-y-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={formRoleIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <span className="text-sm">{role.description || role.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>사용자 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>아이디</Label>
              <Input
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>비밀번호 (변경 시에만 입력)</Label>
              <Input
                type="password"
                placeholder="변경하지 않으려면 비워두세요"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formIsActive}
                onCheckedChange={(checked) => setFormIsActive(checked === true)}
              />
              <Label>활성 상태</Label>
            </div>
            {selectedUser?.employee && (
              <div className="space-y-2">
                <Label>소속 변경</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={formDepartmentId} onValueChange={setFormDepartmentId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="부서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={formPositionId} onValueChange={setFormPositionId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="직위 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>역할</Label>
              <div className="space-y-2 rounded-md border p-3 max-h-48 overflow-y-auto">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={formRoleIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <span className="text-sm">{role.description || role.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>사용자 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{selectedUser?.name}</strong> ({selectedUser?.username}) 사용자를 삭제하시겠습니까?
            <br />이 작업은 되돌릴 수 없습니다.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
