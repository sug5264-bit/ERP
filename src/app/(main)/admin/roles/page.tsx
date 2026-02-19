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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Trash2, Shield } from 'lucide-react'

interface PermissionItem {
  id: string
  module: string
  action: string
  description: string | null
}

interface RoleRow {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissions: { id: string; module: string; action: string }[]
}

const MODULE_LABELS: Record<string, string> = {
  accounting: '회계',
  'accounting.vouchers': '┗ 전표관리',
  'accounting.journal': '┗ 분개장',
  'accounting.ledger': '┗ 총계정원장',
  'accounting.financial': '┗ 재무제표',
  'accounting.tax': '┗ 세금계산서',
  'accounting.budget': '┗ 예산관리',
  hr: '인사',
  'hr.employees': '┗ 사원관리',
  'hr.organization': '┗ 부서/직급',
  'hr.attendance': '┗ 근태관리',
  'hr.leave': '┗ 휴가관리',
  'hr.payroll': '┗ 급여관리',
  'hr.recruitment': '┗ 채용관리',
  inventory: '재고',
  'inventory.items': '┗ 품목관리',
  'inventory.stock': '┗ 입출고',
  'inventory.status': '┗ 재고현황',
  'inventory.warehouses': '┗ 창고관리',
  sales: '판매',
  'sales.summary': '┗ 매출집계',
  'sales.partners': '┗ 거래처관리',
  'sales.quotations': '┗ 견적관리',
  'sales.orders': '┗ 발주관리',
  'sales.deliveries': '┗ 납품관리',
  projects: '프로젝트',
  approval: '전자결재',
  'approval.draft': '┗ 기안하기',
  'approval.pending': '┗ 결재대기',
  'approval.completed': '┗ 결재완료',
  'approval.rejected': '┗ 반려문서',
  board: '게시판',
  'board.notices': '┗ 공지사항',
  'board.general': '┗ 자유게시판',
  'board.messages': '┗ 사내메시지',
  admin: '시스템관리',
  'admin.users': '┗ 사용자관리',
  'admin.roles': '┗ 권한관리',
  'admin.codes': '┗ 코드관리',
  'admin.logs': '┗ 감사로그',
}

const ACTION_LABELS: Record<string, string> = {
  read: '조회',
  create: '생성',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  export: '내보내기',
}

// 모듈 정렬 순서
const MODULE_ORDER = Object.keys(MODULE_LABELS)

export default function RolesPage() {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPermissionIds, setFormPermissionIds] = useState<Set<string>>(new Set())

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/admin/roles') as Promise<any>,
  })

  const { data: permissionsData } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => api.get('/admin/permissions') as Promise<any>,
  })

  const roles: RoleRow[] = rolesData?.data || []
  const permissions: PermissionItem[] = permissionsData?.data || []

  // 모듈별 권한 그룹화
  const modulePermissions = useMemo(() => {
    const groups: Record<string, { module: string; actions: { action: string; permId: string }[] }> = {}

    for (const p of permissions) {
      if (!groups[p.module]) {
        groups[p.module] = { module: p.module, actions: [] }
      }
      groups[p.module].actions.push({ action: p.action, permId: p.id })
    }

    // 정렬
    return Object.values(groups).sort((a, b) => {
      const ai = MODULE_ORDER.indexOf(a.module)
      const bi = MODULE_ORDER.indexOf(b.module)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [permissions])

  // 사용 중인 액션 종류 목록
  const allActions = useMemo(() => {
    const actions = new Set<string>()
    for (const p of permissions) actions.add(p.action)
    const order = ['read', 'create', 'update', 'delete', 'approve', 'export']
    return [...actions].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }, [permissions])

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/roles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setCreateOpen(false)
      resetForm()
      toast.success('역할이 생성되었습니다.')
    },
    onError: (err: any) => toast.error(err?.message || '역할 생성에 실패했습니다.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/admin/roles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setEditOpen(false)
      setSelectedRole(null)
      resetForm()
      toast.success('역할이 수정되었습니다.')
    },
    onError: (err: any) => toast.error(err?.message || '역할 수정에 실패했습니다.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      setDeleteOpen(false)
      setSelectedRole(null)
      toast.success('역할이 삭제되었습니다.')
    },
    onError: (err: any) => toast.error(err?.message || '역할 삭제에 실패했습니다.'),
  })

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormPermissionIds(new Set())
  }

  const openCreate = () => {
    resetForm()
    setCreateOpen(true)
  }

  const openEdit = (role: RoleRow) => {
    setSelectedRole(role)
    setFormName(role.name)
    setFormDescription(role.description || '')
    setFormPermissionIds(new Set(role.permissions.map((p) => p.id)))
    setEditOpen(true)
  }

  const openDelete = (role: RoleRow) => {
    setSelectedRole(role)
    setDeleteOpen(true)
  }

  const togglePermission = (permId: string) => {
    setFormPermissionIds((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) {
        next.delete(permId)
      } else {
        next.add(permId)
      }
      return next
    })
  }

  // 모듈의 모든 권한 토글 (행 전체 선택/해제)
  const toggleModuleAll = (modulePerms: { action: string; permId: string }[]) => {
    setFormPermissionIds((prev) => {
      const next = new Set(prev)
      const allSelected = modulePerms.every((p) => next.has(p.permId))
      for (const p of modulePerms) {
        if (allSelected) {
          next.delete(p.permId)
        } else {
          next.add(p.permId)
        }
      }
      return next
    })
  }

  const handleCreate = () => {
    if (!formName.trim()) {
      toast.error('역할명을 입력하세요.')
      return
    }
    createMutation.mutate({
      name: formName.trim(),
      description: formDescription.trim() || null,
      permissionIds: [...formPermissionIds],
    })
  }

  const handleUpdate = () => {
    if (!selectedRole) return
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        name: formName.trim(),
        description: formDescription.trim() || null,
        permissionIds: [...formPermissionIds],
      },
    })
  }

  const columns: ColumnDef<RoleRow>[] = [
    {
      accessorKey: 'name',
      header: '역할명',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: '설명',
      cell: ({ row }) => row.original.description || '-',
    },
    {
      id: 'permCount',
      header: '권한',
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.permissions.length}개</Badge>
      ),
    },
    {
      id: 'userCount',
      header: '사용자',
      cell: ({ row }) => `${row.original.userCount}명`,
    },
    {
      id: 'type',
      header: '유형',
      cell: ({ row }) => (
        <Badge variant={row.original.isSystem ? 'default' : 'outline'}>
          {row.original.isSystem ? '시스템' : '사용자정의'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: '관리',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {!row.original.isSystem && (
            <Button variant="ghost" size="icon" onClick={() => openDelete(row.original)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const PermissionMatrix = () => (
    <div className="max-h-[50vh] overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">모듈</th>
            {allActions.map((action) => (
              <th key={action} className="px-3 py-2 text-center font-medium whitespace-nowrap">
                {ACTION_LABELS[action] || action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modulePermissions.map((group) => {
            const isParent = !group.module.includes('.')
            return (
              <tr
                key={group.module}
                className={isParent ? 'bg-muted/30 border-t' : 'hover:bg-muted/20'}
              >
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => toggleModuleAll(group.actions)}
                  >
                    {MODULE_LABELS[group.module] || group.module}
                  </button>
                </td>
                {allActions.map((action) => {
                  const perm = group.actions.find((a) => a.action === action)
                  if (!perm) return <td key={action} className="px-3 py-1.5 text-center">-</td>
                  return (
                    <td key={action} className="px-3 py-1.5 text-center">
                      <Checkbox
                        checked={formPermissionIds.has(perm.permId)}
                        onCheckedChange={() => togglePermission(perm.permId)}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="권한관리"
        description="사용자 역할 및 모듈별 권한을 관리합니다"
      />
      <div className="flex justify-end">
        <Button onClick={openCreate}>역할 추가</Button>
      </div>
      <DataTable
        columns={columns}
        data={roles}
        searchColumn="name"
        searchPlaceholder="역할명으로 검색..."
        isLoading={isLoading}
      />

      {/* 생성 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>역할 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>역할명 *</Label>
                <Input
                  placeholder="예: 회계담당자"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>설명</Label>
                <Input
                  placeholder="역할 설명"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>권한 설정</Label>
              <p className="text-xs text-muted-foreground">
                모듈명을 클릭하면 해당 모듈의 모든 권한을 선택/해제합니다. 상위 모듈 권한이 있으면 모든 하위 페이지에 접근할 수 있습니다.
              </p>
              <PermissionMatrix />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>역할 수정 - {selectedRole?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>역할명</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  disabled={selectedRole?.isSystem}
                />
              </div>
              <div className="space-y-2">
                <Label>설명</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>권한 설정</Label>
                <span className="text-xs text-muted-foreground">
                  선택된 권한: {formPermissionIds.size}개
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                모듈명을 클릭하면 해당 모듈의 모든 권한을 선택/해제합니다. 상위 모듈 권한이 있으면 모든 하위 페이지에 접근할 수 있습니다.
              </p>
              <PermissionMatrix />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>취소</Button>
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
            <DialogTitle>역할 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{selectedRole?.name}</strong> 역할을 삭제하시겠습니까?
            <br />이 작업은 되돌릴 수 없습니다.
          </p>
          {selectedRole && selectedRole.userCount > 0 && (
            <p className="text-sm text-destructive">
              현재 {selectedRole.userCount}명의 사용자에게 할당되어 있어 삭제할 수 없습니다.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => selectedRole && deleteMutation.mutate(selectedRole.id)}
              disabled={deleteMutation.isPending || (selectedRole?.userCount ?? 0) > 0}
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
