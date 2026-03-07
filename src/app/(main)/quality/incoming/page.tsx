'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { SearchCheck } from 'lucide-react'

export default function IncomingInspectionPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="입고검사"
        description="입고 물품의 품질 검사를 수행하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <SearchCheck className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">입고검사 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}
