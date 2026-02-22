'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, CalendarOff, Briefcase } from 'lucide-react'

export default function HRPage() {
  const { data: empData } = useQuery({
    queryKey: ['hr-employees-summary'],
    queryFn: () => api.get('/hr/employees?pageSize=1') as Promise<any>,
  })

  const { data: attendanceData } = useQuery({
    queryKey: ['hr-attendance-today'],
    queryFn: () => api.get(`/hr/attendance?date=${new Date().toISOString().split('T')[0]}&pageSize=1`) as Promise<any>,
  })

  const { data: leaveData } = useQuery({
    queryKey: ['hr-leave-pending'],
    queryFn: () => api.get('/hr/leave?status=REQUESTED&pageSize=1') as Promise<any>,
  })

  const { data: recruitData } = useQuery({
    queryKey: ['hr-recruit-open'],
    queryFn: () => api.get('/hr/recruitment?status=OPEN&pageSize=1') as Promise<any>,
  })

  const totalEmployees = empData?.meta?.totalCount ?? 0
  const todayAttendance = attendanceData?.meta?.totalCount ?? 0
  const pendingLeaves = leaveData?.meta?.totalCount ?? 0
  const openRecruits = recruitData?.meta?.totalCount ?? 0

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">인사 모듈</h1>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">총 사원 수</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{totalEmployees}명</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">금일 출근</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{todayAttendance}명</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">휴가 승인대기</CardTitle>
            <CalendarOff className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className={`text-lg sm:text-2xl font-bold ${pendingLeaves > 0 ? 'text-orange-600 dark:text-orange-500' : ''}`}>{pendingLeaves}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium">진행중 채용</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg sm:text-2xl font-bold">{openRecruits}건</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
