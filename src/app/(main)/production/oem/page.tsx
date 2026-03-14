'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function OemPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="OEM 위탁현황" description="OEM 위탁 계약을 등록하고 관리합니다." />
      <ComingSoon title="OEM 위탁현황" />
    </div>
  )
}
