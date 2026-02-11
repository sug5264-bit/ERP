import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HRPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">인사 모듈</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Module KPI cards will be added */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">총 사원 수</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">준비 중</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">금일 출근</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">준비 중</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">휴가 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">준비 중</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
