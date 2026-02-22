'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatDateTime, formatDistanceToNow } from '@/lib/format'
import { toast } from 'sonner'
import {
  User, KeyRound, FileText, CalendarOff, Bell, Shield, Clock,
} from 'lucide-react'
import Link from 'next/link'

const LEAVE_TYPE_MAP: Record<string, string> = {
  ANNUAL: '연차', SICK: '병가', FAMILY: '경조사', MATERNITY: '출산', PARENTAL: '육아', OFFICIAL: '공가',
}

const APPROVAL_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFTED: { label: '임시저장', variant: 'outline' },
  IN_PROGRESS: { label: '진행중', variant: 'secondary' },
  APPROVED: { label: '승인', variant: 'default' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'outline' },
}

const LEAVE_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  REQUESTED: { label: '승인대기', variant: 'outline' },
  APPROVED: { label: '승인', variant: 'default' },
  REJECTED: { label: '반려', variant: 'destructive' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

export default function MyPage() {
  const [pwOpen, setPwOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['mypage'],
    queryFn: () => api.get('/mypage') as Promise<any>,
  })

  const pwMutation = useMutation({
    mutationFn: (body: any) => api.put('/mypage', body),
    onSuccess: () => { setPwOpen(false); toast.success('비밀번호가 변경되었습니다.') },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const newPw = form.get('newPassword') as string
    const confirmPw = form.get('confirmPassword') as string
    if (newPw.length < 8) { toast.error('비밀번호는 8자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { toast.error('새 비밀번호가 일치하지 않습니다.'); return }
    pwMutation.mutate({
      action: 'changePassword',
      currentPassword: form.get('currentPassword'),
      newPassword: newPw,
    })
  }

  if (isLoading) return (
    <div className="space-y-4 sm:space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {[1, 2].map((i) => (
          <Card key={`skeleton-${i}`}>
            <CardContent className="p-6 space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={`skel-${i}-${j}`} className="h-4 animate-pulse rounded bg-muted" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const { user, leaveBalances, myApprovals, myLeaves, loginHistory } = data?.data || {}
  const emp = user?.employee

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="마이페이지" description="내 정보와 활동 내역을 확인합니다" />

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="info" className="text-xs sm:text-sm gap-1">
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">내 정보</span>
            <span className="sm:hidden">정보</span>
          </TabsTrigger>
          <TabsTrigger value="leave" className="text-xs sm:text-sm gap-1">
            <CalendarOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>휴가</span>
          </TabsTrigger>
          <TabsTrigger value="approval" className="text-xs sm:text-sm gap-1">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>결재</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm gap-1">
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>보안</span>
          </TabsTrigger>
        </TabsList>

        {/* 내 정보 탭 */}
        <TabsContent value="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader><CardTitle className="text-sm sm:text-base">기본 정보</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="이름" value={emp?.nameKo || user?.name} />
                <InfoRow label="영문명" value={emp?.nameEn || '-'} />
                <InfoRow label="사번" value={emp?.employeeNo || '-'} />
                <InfoRow label="부서" value={emp?.department?.name || '-'} />
                <InfoRow label="직급" value={emp?.position?.name || '-'} />
                <InfoRow label="입사일" value={emp?.joinDate ? formatDate(emp.joinDate) : '-'} />
                <InfoRow label="고용형태" value={emp?.employeeType === 'REGULAR' ? '정규직' : emp?.employeeType === 'CONTRACT' ? '계약직' : emp?.employeeType || '-'} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm sm:text-base">계정 정보</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow label="아이디" value={user?.username} />
                <InfoRow label="이메일" value={user?.email} />
                <InfoRow label="연락처" value={emp?.phone || '-'} />
                <InfoRow label="최근 로그인" value={user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : '-'} />
                <InfoRow label="가입일" value={formatDate(user?.createdAt)} />
                <div className="pt-2">
                  <Dialog open={pwOpen} onOpenChange={setPwOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><KeyRound className="mr-1 h-4 w-4" /> 비밀번호 변경</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
                      <DialogHeader><DialogTitle>비밀번호 변경</DialogTitle></DialogHeader>
                      <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-2"><Label>현재 비밀번호</Label><Input name="currentPassword" type="password" required /></div>
                        <div className="space-y-2"><Label>새 비밀번호 (8자 이상)</Label><Input name="newPassword" type="password" required minLength={8} /></div>
                        <div className="space-y-2"><Label>새 비밀번호 확인</Label><Input name="confirmPassword" type="password" required minLength={8} /></div>
                        <Button type="submit" className="w-full" disabled={pwMutation.isPending}>
                          {pwMutation.isPending ? '변경 중...' : '비밀번호 변경'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 휴가 탭 */}
        <TabsContent value="leave">
          <div className="space-y-4 sm:space-y-6">
            {/* 휴가 잔여 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {(leaveBalances || []).length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    올해 휴가 잔여 정보가 없습니다.
                  </CardContent>
                </Card>
              ) : (
                (leaveBalances || []).map((lb: any) => (
                  <Card key={lb.id}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{lb.year}년 휴가</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-xl sm:text-2xl font-bold">{Number(lb.remainingDays)}일</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        총 {Number(lb.totalDays)}일 / 사용 {Number(lb.usedDays)}일
                      </p>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (Number(lb.usedDays) / Number(lb.totalDays)) * 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* 내 휴가 내역 */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base">올해 휴가 내역</CardTitle>
                  <Link href="/hr/leave"><Badge variant="outline" className="cursor-pointer text-xs">전체보기</Badge></Link>
                </div>
              </CardHeader>
              <CardContent>
                {(myLeaves || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">휴가 내역이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {(myLeaves || []).map((l: any) => (
                      <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm border-b pb-2 last:border-0 gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{LEAVE_TYPE_MAP[l.leaveType] || l.leaveType}</Badge>
                          <span className="text-xs sm:text-sm">{formatDate(l.startDate)} ~ {formatDate(l.endDate)}</span>
                          <span className="text-muted-foreground text-xs">({l.days}일)</span>
                        </div>
                        <Badge variant={LEAVE_STATUS[l.status]?.variant || 'outline'} className="w-fit text-xs">
                          {LEAVE_STATUS[l.status]?.label || l.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 결재 탭 */}
        <TabsContent value="approval">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base">내 결재 문서</CardTitle>
                <Link href="/approval/draft"><Badge variant="outline" className="cursor-pointer text-xs">기안하기</Badge></Link>
              </div>
            </CardHeader>
            <CardContent>
              {(myApprovals || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">결재 문서가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {(myApprovals || []).map((doc: any) => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm border-b pb-2 last:border-0 gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs shrink-0">{doc.documentNo}</span>
                        <span className="font-medium truncate">{doc.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{doc.currentStep}/{doc.totalSteps}</span>
                        <Badge variant={APPROVAL_STATUS[doc.status]?.variant || 'outline'} className="text-xs">
                          {APPROVAL_STATUS[doc.status]?.label || doc.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(doc.draftDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 보안 탭 */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Clock className="h-4 w-4" /> 최근 로그인 이력</CardTitle></CardHeader>
            <CardContent>
              {(loginHistory || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">로그인 이력이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {(loginHistory || []).map((log: any) => (
                    <div key={log.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                      <span className="font-mono text-xs">{log.ipAddress || '-'}</span>
                      <span className="text-muted-foreground text-xs sm:text-sm">{formatDateTime(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate">{value || '-'}</span>
    </div>
  )
}
