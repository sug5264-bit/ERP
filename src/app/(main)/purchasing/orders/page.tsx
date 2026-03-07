'use client'

import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'

export default function PurchasingOrdersPage() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="발주관리"
        description="원자재 및 부자재 발주를 등록하고 관리합니다"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="bg-muted rounded-full p-4">
            <ClipboardList className="text-muted-foreground h-8 w-8" />
          </div>
          <p className="text-muted-foreground mt-4 text-sm">발주관리 페이지가 준비 중입니다</p>
        </CardContent>
      </Card>
    </div>
  )
}
