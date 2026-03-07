'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarClock } from 'lucide-react'

export default function ProductionPlanPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="생산계획"
        description="생산 계획을 수립하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <CalendarClock className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">생산계획 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}
