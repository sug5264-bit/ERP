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
import { toast } from 'sonner'

interface CodeRow {
  id: string
  groupCode: string
  code: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  extra1: string | null
  extra2: string | null
}

const GROUP_CODES = [
  { value: 'BANK', label: '은행' },
  { value: 'UNIT', label: '단위' },
  { value: 'PAYMENT_TERMS', label: '결제조건' },
  { value: 'PAYMENT_METHOD', label: '결제방법' },
  { value: 'BIZ_TYPE', label: '업종' },
  { value: 'INSURANCE_RATE', label: '4대보험요율' },
]

const columns: ColumnDef<CodeRow>[] = [
  {
    accessorKey: 'groupCode',
    header: '그룹코드',
    cell: ({ row }) => (
      <Badge variant="outline">{row.original.groupCode}</Badge>
    ),
  },
  {
    accessorKey: 'code',
    header: '코드',
  },
  {
    accessorKey: 'name',
    header: '코드명',
  },
  {
    accessorKey: 'description',
    header: '설명',
    cell: ({ row }) => row.original.description || '-',
  },
  {
    accessorKey: 'sortOrder',
    header: '정렬',
  },
  {
    accessorKey: 'isActive',
    header: '상태',
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'default' : 'destructive'}>
        {row.original.isActive ? '사용' : '미사용'}
      </Badge>
    ),
  },
]

export default function CodesPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>('')
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-codes', selectedGroup],
    queryFn: () =>
      api.get(
        `/admin/codes${selectedGroup && selectedGroup !== 'all' ? `?groupCode=${selectedGroup}` : ''}`
      ) as Promise<any>,
  })

  const createMutation = useMutation({
    mutationFn: (body: any) => api.post('/admin/codes', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-codes'] })
      setOpen(false)
      toast.success('코드가 등록되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const codes: CodeRow[] = data?.data || []

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    createMutation.mutate({
      groupCode: form.get('groupCode'),
      code: form.get('code'),
      name: form.get('name'),
      description: form.get('description') || undefined,
      sortOrder: parseInt(form.get('sortOrder') as string) || 0,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="코드관리"
        description="시스템 공통 코드를 관리합니다"
      />
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="전체 그룹" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {GROUP_CODES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>코드 등록</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>공통코드 등록</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>그룹코드 <span className="text-destructive">*</span></Label>
                <Input name="groupCode" required aria-required="true" placeholder="BANK" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>코드 <span className="text-destructive">*</span></Label>
                  <Input name="code" required aria-required="true" />
                </div>
                <div className="space-y-2">
                  <Label>코드명 <span className="text-destructive">*</span></Label>
                  <Input name="name" required aria-required="true" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>설명</Label>
                <Input name="description" />
              </div>
              <div className="space-y-2">
                <Label>정렬순서</Label>
                <Input name="sortOrder" type="number" defaultValue={0} />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? '등록 중...' : '코드 등록'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={columns}
        data={codes}
        searchColumn="name"
        searchPlaceholder="코드명으로 검색..."
        isLoading={isLoading}
        pageSize={50}
      />
    </div>
  )
}
