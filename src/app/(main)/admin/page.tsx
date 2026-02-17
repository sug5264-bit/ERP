'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Shield, ScrollText, Settings } from 'lucide-react'

export default function AdminPage() {
  const { data: userData } = useQuery({
    queryKey: ['admin-users-summary'],
    queryFn: () => api.get('/admin/users?pageSize=1') as Promise<any>,
  })

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles-summary'],
    queryFn: () => api.get('/admin/roles') as Promise<any>,
  })

  const { data: logsData } = useQuery({
    queryKey: ['admin-logs-summary'],
    queryFn: () => api.get('/admin/logs?pageSize=1') as Promise<any>,
  })

  const { data: codesData } = useQuery({
    queryKey: ['admin-codes-summary'],
    queryFn: () => api.get('/admin/codes') as Promise<any>,
  })

  const totalUsers = userData?.meta?.totalCount ?? 0
  const totalRoles = rolesData?.data?.length ?? 0
  const totalLogs = logsData?.meta?.totalCount ?? 0
  const totalCodes = codesData?.data?.length ?? 0

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">시스템 관리</h1>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">전체 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{totalUsers}명</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">역할 수</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{totalRoles}개</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">감사 로그</CardTitle>
            <ScrollText className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{totalLogs.toLocaleString()}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">공통코드</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{totalCodes}개</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
