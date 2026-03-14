'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="매입처관리" description="매입 거래처를 등록하고 관리합니다." />
      <ComingSoon title="매입처관리" />
    </div>
  )
}
