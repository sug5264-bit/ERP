'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { api } from '@/hooks/use-api'
import { DataTable } from '@/components/common/data-table'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/format'

interface LogRow {
  id: string
  tableName: string
  recordId: string
  action: string
  changes: any
  ipAddress: string | null
  createdAt: string
  user: { name: string; email: string } | null
}

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
}

const columns: ColumnDef<LogRow>[] = [
  {
    accessorKey: 'createdAt',
    header: '일시',
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
  {
    header: '사용자',
    cell: ({ row }) => row.original.user?.name || '-',
  },
  {
    accessorKey: 'action',
    header: '작업',
    cell: ({ row }) => (
      <Badge variant={ACTION_COLORS[row.original.action] || 'outline'}>
        {row.original.action}
      </Badge>
    ),
  },
  {
    accessorKey: 'tableName',
    header: '대상 테이블',
  },
  {
    accessorKey: 'recordId',
    header: '레코드 ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.recordId.slice(0, 8)}...</span>
    ),
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP',
    cell: ({ row }) => row.original.ipAddress || '-',
  },
]

export default function LogsPage() {
  const [action, setAction] = useState<string>('')
  const [tableName, setTableName] = useState('')

  const queryParams = new URLSearchParams({ pageSize: '50' })
  if (action && action !== 'all') queryParams.set('action', action)
  if (tableName) queryParams.set('tableName', tableName)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-logs', action, tableName],
    queryFn: () =>
      api.get(`/admin/logs?${queryParams.toString()}`) as Promise<any>,
  })

  const logs: LogRow[] = data?.data || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="감사로그"
        description="시스템 사용 기록을 조회합니다"
      />
      <div className="flex items-center gap-4">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="전체 작업" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="CREATE">생성</SelectItem>
            <SelectItem value="UPDATE">수정</SelectItem>
            <SelectItem value="DELETE">삭제</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="테이블명 필터..."
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        pageSize={50}
      />
    </div>
  )
}
