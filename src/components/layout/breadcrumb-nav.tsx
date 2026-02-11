'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'

const pathLabels: Record<string, string> = {
  dashboard: '대시보드',
  accounting: '회계',
  vouchers: '전표관리',
  journal: '분개장',
  ledger: '총계정원장',
  'financial-statements': '재무제표',
  'tax-invoice': '세금계산서',
  budget: '예산관리',
  hr: '인사',
  employees: '사원관리',
  organization: '부서/직급',
  attendance: '근태관리',
  leave: '휴가관리',
  payroll: '급여관리',
  recruitment: '채용관리',
  inventory: '재고',
  items: '품목관리',
  'stock-movement': '입출고',
  'stock-status': '재고현황',
  warehouses: '창고관리',
  sales: '판매',
  summary: '매출집계',
  partners: '거래처관리',
  quotations: '견적관리',
  orders: '발주관리',
  deliveries: '납품관리',
  approval: '전자결재',
  draft: '기안하기',
  pending: '결재대기',
  completed: '결재완료',
  rejected: '반려문서',
  board: '게시판',
  notices: '공지사항',
  general: '자유게시판',
  messages: '사내메시지',
  admin: '시스템관리',
  users: '사용자관리',
  roles: '권한관리',
  codes: '코드관리',
  logs: '감사로그',
  new: '신규',
  edit: '수정',
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const label = pathLabels[segment] || segment
          const isLast = index === segments.length - 1

          return (
            <Fragment key={href}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
