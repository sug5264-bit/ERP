'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, CalendarOff, Briefcase } from 'lucide-react'
import { getLocalDateString } from '@/lib/format'

export default function HRPage() {
  const today = getLocalDateString()

  const { data: empData } = useQuery({
    queryKey: ['hr-employees-summary'],
    queryFn: () => api.get('/hr/employees?pageSize=1') as Promise<any>,
  })

  const { data: attendanceData } = useQuery({
    queryKey: ['hr-attendance-today', today],
    queryFn: () => api.get(`/hr/attendance?date=${today}&pageSize=1`) as Promise<any>,
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
    <div className="animate-fade-in-up space-y-4 sm:space-y-6">
      <h1 className="text-lg font-bold tracking-tight sm:text-2xl">인사 모듈</h1>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">총 사원 수</CardTitle>
            <div className="bg-muted hidden rounded-md p-1.5 sm:block">
              <Users className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {totalEmployees}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">명</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">금일 출근</CardTitle>
            <div className="bg-status-success-muted hidden rounded-md p-1.5 sm:block">
              <Clock className="text-status-success h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {todayAttendance}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">명</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">휴가 승인대기</CardTitle>
            <div className="bg-status-warning-muted hidden rounded-md p-1.5 sm:block">
              <CalendarOff className="text-status-warning h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className={`text-lg font-bold sm:text-2xl ${pendingLeaves > 0 ? 'text-status-warning' : ''}`}>
              {pendingLeaves}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-3 pb-1 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">진행중 채용</CardTitle>
            <div className="bg-status-info-muted hidden rounded-md p-1.5 sm:block">
              <Briefcase className="text-status-info h-3.5 w-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <p className="text-lg font-bold sm:text-2xl">
              {openRecruits}
              <span className="text-muted-foreground ml-0.5 text-sm font-normal">건</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
