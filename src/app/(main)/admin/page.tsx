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
    <div className="animate-fade-in-up space-y-4 sm:space-y-6">
      <h1 className="text-lg font-bold tracking-tight sm:text-2xl">시스템 관리</h1>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">전체 사용자</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <Users className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {totalUsers}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">명</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">역할 수</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <Shield className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {totalRoles}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">개</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">감사 로그</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <ScrollText className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {totalLogs.toLocaleString()}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">공통코드</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <Settings className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {totalCodes}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">개</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
