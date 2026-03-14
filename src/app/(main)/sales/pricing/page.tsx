'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function PricingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="단가관리" description="거래처별 품목 단가를 등록하고 관리합니다." />
      <ComingSoon title="단가관리" />
    </div>
  )
}
