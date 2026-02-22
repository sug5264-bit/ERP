'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function ApprovalPage() {
  const { data: drafts } = useQuery({ queryKey: ['approval-drafts-summary'], queryFn: () => api.get('/approval/documents?filter=myDrafts&pageSize=5') as Promise<any> })
  const { data: pending } = useQuery({ queryKey: ['approval-pending-summary'], queryFn: () => api.get('/approval/documents?filter=myApprovals&pageSize=5') as Promise<any> })

  const draftCount = drafts?.meta?.totalCount || 0
  const pendingCount = pending?.meta?.totalCount || 0

  return (
    <div className="space-y-6">
      <PageHeader title="전자결재" description="전자결재 문서를 기안하고 관리합니다" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">내 기안문서</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{draftCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">결재 대기</CardTitle><Clock className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{pendingCount}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">결재 완료</CardTitle><CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600 dark:text-green-500">-</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">반려</CardTitle><XCircle className="h-4 w-4 text-red-500 dark:text-red-400" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600 dark:text-red-500">-</div></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">내 기안문서</CardTitle>
            <Link href="/approval/draft"><Button variant="ghost" size="sm">더보기</Button></Link>
          </CardHeader>
          <CardContent>
            {(drafts?.data || []).length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">기안 문서가 없습니다.</p>
              </div>
            ) :
              <ul className="space-y-2">{(drafts?.data || []).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span>{d.title}</span>
                  <span className="text-muted-foreground">{d.status}</span>
                </li>
              ))}</ul>
            }
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">결재 대기</CardTitle>
            <Link href="/approval/pending"><Button variant="ghost" size="sm">더보기</Button></Link>
          </CardHeader>
          <CardContent>
            {(pending?.data || []).length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">결재 대기 문서가 없습니다.</p>
              </div>
            ) :
              <ul className="space-y-2">{(pending?.data || []).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span>{d.title}</span>
                  <span className="text-muted-foreground">{d.drafter?.nameKo}</span>
                </li>
              ))}</ul>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
