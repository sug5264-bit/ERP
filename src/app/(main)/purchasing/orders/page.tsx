'use client'

import { PageHeader } from '@/components/common/page-header'
import { ComingSoon } from '@/components/common/coming-soon'

export default function PurchaseOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="발주관리" description="발주서를 등록하고 관리합니다." />
      <ComingSoon title="발주관리" />
    </div>
  )
}
