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
  FolderKanban,
  type LucideIcon,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useState, useMemo, useCallback, memo } from 'react'
import { useSidebarStore } from '@/stores/sidebar-store'

interface NavChild {
  title: string
  href: string
  permission?: string
}

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  module?: string
  children?: NavChild[]
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
      { title: '전표관리', href: '/accounting/vouchers', permission: 'accounting.vouchers' },
      { title: '분개장', href: '/accounting/journal', permission: 'accounting.journal' },
      { title: '총계정원장', href: '/accounting/ledger', permission: 'accounting.ledger' },
      { title: '재무제표', href: '/accounting/financial-statements', permission: 'accounting.financial' },
      { title: '세금계산서', href: '/accounting/tax-invoice', permission: 'accounting.tax' },
      { title: '예산관리', href: '/accounting/budget', permission: 'accounting.budget' },
    ],
  },
  {
    title: '인사',
    href: '/hr',
    icon: Users,
    module: 'hr',
    children: [
      { title: '사원관리', href: '/hr/employees', permission: 'hr.employees' },
      { title: '부서/직급', href: '/hr/organization', permission: 'hr.organization' },
      { title: '근태관리', href: '/hr/attendance', permission: 'hr.attendance' },
      { title: '휴가관리', href: '/hr/leave', permission: 'hr.leave' },
      { title: '급여관리', href: '/hr/payroll', permission: 'hr.payroll' },
      { title: '채용관리', href: '/hr/recruitment', permission: 'hr.recruitment' },
    ],
  },
  {
    title: '재고',
    href: '/inventory',
    icon: Package,
    module: 'inventory',
    children: [
      { title: '품목관리', href: '/inventory/items', permission: 'inventory.items' },
      { title: '입출고', href: '/inventory/stock-movement', permission: 'inventory.stock' },
      { title: '재고현황', href: '/inventory/stock-status', permission: 'inventory.status' },
      { title: '창고관리', href: '/inventory/warehouses', permission: 'inventory.warehouses' },
    ],
  },
  {
    title: '판매',
    href: '/sales',
    icon: ShoppingCart,
    module: 'sales',
    children: [
      { title: '매출집계', href: '/sales/summary', permission: 'sales.summary' },
      { title: '거래처관리', href: '/sales/partners', permission: 'sales.partners' },
      { title: '견적관리', href: '/sales/quotations', permission: 'sales.quotations' },
      { title: '발주관리', href: '/sales/orders', permission: 'sales.orders' },
      { title: '납품관리', href: '/sales/deliveries', permission: 'sales.deliveries' },
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
      { title: '기안하기', href: '/approval/draft', permission: 'approval.draft' },
      { title: '결재대기', href: '/approval/pending', permission: 'approval.pending' },
      { title: '결재완료', href: '/approval/completed', permission: 'approval.completed' },
      { title: '반려문서', href: '/approval/rejected', permission: 'approval.rejected' },
    ],
  },
  {
    title: '게시판',
    href: '/board',
    icon: MessageSquare,
    module: 'board',
    children: [
      { title: '공지사항', href: '/board/notices', permission: 'board.notices' },
      { title: '자유게시판', href: '/board/general', permission: 'board.general' },
      { title: '사내메시지', href: '/board/messages', permission: 'board.messages' },
    ],
  },
  {
    title: '시스템관리',
    href: '/admin',
    icon: Settings,
    module: 'admin',
    children: [
      { title: '사용자관리', href: '/admin/users', permission: 'admin.users' },
      { title: '권한관리', href: '/admin/roles', permission: 'admin.roles' },
      { title: '코드관리', href: '/admin/codes', permission: 'admin.codes' },
      { title: '감사로그', href: '/admin/logs', permission: 'admin.logs' },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const setOpen = useSidebarStore((s) => s.setOpen)

  const userPermissions = (session?.user as any)?.permissions || []
  const userRoles = (session?.user as any)?.roles || []
  const isAdmin = userRoles.includes('SYSTEM_ADMIN') || userRoles.includes('관리자')

  const hasPermission = useCallback(
    (module: string) =>
      userPermissions.some(
        (p: any) =>
          (p.module === module || p.module.startsWith(module + '.')) &&
          p.action === 'read'
      ),
    [userPermissions]
  )

  const filteredNavItems = useMemo(() => {
    return navItems
      .map((item) => {
        if (!item.module) return item
        if (isAdmin) return item

        // 모듈 전체 권한 보유 시 모든 하위 페이지 표시
        const hasModuleAccess = userPermissions.some(
          (p: any) => p.module === item.module && p.action === 'read'
        )
        if (hasModuleAccess) return item

        // 하위 페이지별 권한 체크
        if (item.children) {
          const filteredChildren = item.children.filter((child) => {
            if (!child.permission) return hasModuleAccess
            return userPermissions.some(
              (p: any) => p.module === child.permission && p.action === 'read'
            )
          })
          if (filteredChildren.length === 0) return null
          return { ...item, children: filteredChildren }
        }

        // 자식 없는 단일 항목은 모듈 또는 하위 모듈 권한 체크
        if (hasModuleAccess || hasPermission(item.module)) return item
        return null
      })
      .filter(Boolean) as NavItem[]
  }, [userPermissions, userRoles, isAdmin, hasPermission])

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth < 1024) setOpen(false)
  }, [setOpen])

  return (
    <nav className="flex flex-col gap-1 p-2">
      {filteredNavItems.map((item) => (
        <NavItemComponent
          key={item.href}
          item={item}
          pathname={pathname}
          onNavigate={closeMobileSidebar}
        />
      ))}
    </nav>
  )
}

const NavItemComponent = memo(function NavItemComponent({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const [isOpen, setIsOpen] = useState(isActive)

  if (!item.children) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
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
          'flex w-full items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
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
                onClick={onNavigate}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
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
})
