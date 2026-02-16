'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calculator,
  Users,
  Package,
  ShoppingCart,
  FileCheck,
  MessageSquare,
  Settings,
  ChevronDown,
  Truck,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useState } from 'react'

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  module?: string
  children?: { title: string; href: string }[]
}

const navItems: NavItem[] = [
  {
    title: '대시보드',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '회계',
    href: '/accounting',
    icon: Calculator,
    module: 'accounting',
    children: [
      { title: '전표관리', href: '/accounting/vouchers' },
      { title: '분개장', href: '/accounting/journal' },
      { title: '총계정원장', href: '/accounting/ledger' },
      { title: '재무제표', href: '/accounting/financial-statements' },
      { title: '세금계산서', href: '/accounting/tax-invoice' },
      { title: '예산관리', href: '/accounting/budget' },
    ],
  },
  {
    title: '인사',
    href: '/hr',
    icon: Users,
    module: 'hr',
    children: [
      { title: '사원관리', href: '/hr/employees' },
      { title: '부서/직급', href: '/hr/organization' },
      { title: '근태관리', href: '/hr/attendance' },
      { title: '휴가관리', href: '/hr/leave' },
      { title: '급여관리', href: '/hr/payroll' },
      { title: '채용관리', href: '/hr/recruitment' },
    ],
  },
  {
    title: '재고',
    href: '/inventory',
    icon: Package,
    module: 'inventory',
    children: [
      { title: '품목관리', href: '/inventory/items' },
      { title: '입출고', href: '/inventory/stock-movement' },
      { title: '재고현황', href: '/inventory/stock-status' },
      { title: '창고관리', href: '/inventory/warehouses' },
    ],
  },
  {
    title: '판매',
    href: '/sales',
    icon: ShoppingCart,
    module: 'sales',
    children: [
      { title: '매출집계', href: '/sales/summary' },
      { title: '거래처관리', href: '/sales/partners' },
      { title: '견적관리', href: '/sales/quotations' },
      { title: '발주관리', href: '/sales/orders' },
      { title: '납품관리', href: '/sales/deliveries' },
    ],
  },
  {
    title: '구매',
    href: '/procurement',
    icon: Truck,
    module: 'procurement',
    children: [
      { title: '구매요청', href: '/procurement/requests' },
      { title: '구매발주', href: '/procurement/purchase-orders' },
      { title: '입고관리', href: '/procurement/receiving' },
      { title: '구매대금', href: '/procurement/payments' },
    ],
  },
  {
    title: '프로젝트',
    href: '/projects',
    icon: FolderKanban,
    module: 'projects',
  },
  {
    title: '전자결재',
    href: '/approval',
    icon: FileCheck,
    module: 'approval',
    children: [
      { title: '기안하기', href: '/approval/draft' },
      { title: '결재대기', href: '/approval/pending' },
      { title: '결재완료', href: '/approval/completed' },
      { title: '반려문서', href: '/approval/rejected' },
    ],
  },
  {
    title: '게시판',
    href: '/board',
    icon: MessageSquare,
    module: 'board',
    children: [
      { title: '공지사항', href: '/board/notices' },
      { title: '자유게시판', href: '/board/general' },
      { title: '사내메시지', href: '/board/messages' },
    ],
  },
  {
    title: '시스템관리',
    href: '/admin',
    icon: Settings,
    module: 'admin',
    children: [
      { title: '사용자관리', href: '/admin/users' },
      { title: '권한관리', href: '/admin/roles' },
      { title: '코드관리', href: '/admin/codes' },
      { title: '감사로그', href: '/admin/logs' },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const userPermissions = (session?.user as any)?.permissions || []
  const userRoles = (session?.user as any)?.roles || []
  const isAdmin = userRoles.includes('SYSTEM_ADMIN') || userRoles.includes('관리자')

  const filteredNavItems = navItems.filter((item) => {
    if (!item.module) return true
    if (isAdmin) return true
    // 부서장도 모든 메뉴 접근 가능
    if (userRoles.includes('부서장')) return true
    return userPermissions.some(
      (p: any) => p.module === item.module && p.action === 'read'
    )
  })

  return (
    <nav className="flex flex-col gap-1 p-2">
      {filteredNavItems.map((item) => (
        <NavItemComponent
          key={item.href}
          item={item}
          pathname={pathname}
        />
      ))}
    </nav>
  )
}

function NavItemComponent({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const [isOpen, setIsOpen] = useState(isActive)

  if (!item.children) {
    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <item.icon className="h-4 w-4" />
        <span>{item.title}</span>
      </Link>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l pl-4">
          {item.children.map((child) => {
            const childActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  childActive
                    ? 'font-medium text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {child.title}
              </Link>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
