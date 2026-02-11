import { PageHeader } from '@/components/common/page-header'

export default function RecruitmentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="채용관리"
        description="채용 공고 및 지원자를 관리합니다"
        createHref="/hr/recruitment/new"
        createLabel="신규"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        데이터 테이블이 표시됩니다.
      </div>
    </div>
  )
}
