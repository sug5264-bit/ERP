'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function ReceivingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="입고관리" description="발주 품목의 입고를 확인하고 관리합니다." />
      <ComingSoon title="입고관리" />
    </div>
  )
}
