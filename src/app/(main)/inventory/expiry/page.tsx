'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarX2 } from 'lucide-react'

export default function ExpiryManagementPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="유통기한관리"
        description="제품의 유통기한을 추적하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <CalendarX2 className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">유통기한관리 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}
