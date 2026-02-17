'use client'

import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { useState } from 'react'

interface RoleRow {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: { id: string; module: string; action: string }[]
  _count: { users: number }
}

const columns: ColumnDef<RoleRow>[] = [
  {
    accessorKey: 'name',
    header: '역할명',
    cell: ({ row }) => (
      <div className="font-medium">{row.original.name}</div>
    ),
  },
  {
    accessorKey: 'description',
    header: '설명',
    cell: ({ row }) => row.original.description || '-',
  },
  {
    header: '권한 수',
    cell: ({ row }) => (
      <Badge variant="secondary">{row.original.permissions.length}개</Badge>
    ),
  },
  {
    header: '사용자 수',
    cell: ({ row }) => `${row.original._count.users}명`,
  },
  {
    header: '유형',
    cell: ({ row }) => (
      <Badge variant={row.original.isSystem ? 'default' : 'outline'}>
        {row.original.isSystem ? '시스템' : '사용자'}
      </Badge>
    ),
  },
]

const MODULE_LABELS: Record<string, string> = {
  system: '시스템관리',
  hr: '인사관리',
  accounting: '회계관리',
  inventory: '재고관리',
  sales: '영업관리',
  project: '프로젝트',
  approval: '전자결재',
  board: '게시판',
}

const ACTION_LABELS: Record<string, string> = {
  read: '조회',
  create: '생성',
  update: '수정',
  delete: '삭제',
  approve: '승인',
  export: '내보내기',
}

export default function RolesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/admin/roles') as Promise<any>,
  })

  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null)
  const roles: RoleRow[] = data?.data || []

  const moduleGroups = selectedRole
    ? selectedRole.permissions.reduce(
        (acc, p) => {
          if (!acc[p.module]) acc[p.module] = []
          acc[p.module].push(p.action)
          return acc
        },
        {} as Record<string, string[]>
      )
    : {}

  return (
    <div className="space-y-6">
      <PageHeader
        title="권한관리"
        description="사용자 역할 및 권한을 관리합니다"
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DataTable
            columns={columns}
            data={roles}
            searchColumn="name"
            searchPlaceholder="역할명으로 검색..."
            isLoading={isLoading}
          />
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-4 font-semibold">권한 상세</h3>
          {selectedRole ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{selectedRole.name}</p>
              <Accordion type="multiple" className="w-full">
                {Object.entries(moduleGroups).map(([mod, actions]) => (
                  <AccordionItem key={mod} value={mod}>
                    <AccordionTrigger className="text-sm">
                      {MODULE_LABELS[mod] || mod}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {actions.map((action) => (
                          <div key={action} className="flex items-center gap-2">
                            <Checkbox checked disabled />
                            <span className="text-sm">
                              {ACTION_LABELS[action] || action}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="mb-4 text-sm text-muted-foreground">
                역할을 선택하면 권한 상세가 표시됩니다.
              </p>
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className="block w-full rounded-md border p-2 text-left text-sm hover:bg-muted"
                >
                  {role.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
