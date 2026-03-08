'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Factory,
  Warehouse,
  ShieldCheck,
  Calculator,
  Users,
  CalendarCheck,
  FileCheck,
  MessageSquare,
  Settings,
  FolderKanban,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useState, useMemo, useCallback, memo } from 'react'
import { useSidebarStore } from '@/stores/sidebar-store'

interface NavChild {
  title: string
  href: string
  permission?: string
  children?: NavChild[]
}

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  module?: string
  children?: NavChild[]
}

// SAP 모듈 기준 식품 유통사 메뉴 구조
const navItems: NavItem[] = [
  {
    title: '대시보드',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: '영업관리',
    href: '/sales',
    icon: ShoppingCart,
    module: 'sales',
    children: [
      {
        title: '출하관리',
        href: '/sales/deliveries',
        permission: 'sales.deliveries',
        children: [
          { title: '출하현황', href: '/sales/deliveries' },
          { title: '수주/출하 추적', href: '/sales/deliveries/order-tracking' },
          { title: '온라인 매출', href: '/sales/deliveries/online-sales' },
        ],
      },
      { title: '매출현황', href: '/sales/summary', permission: 'sales.summary' },
      { title: '매출처관리', href: '/sales/partners', permission: 'sales.partners' },
      { title: '견적관리', href: '/sales/quotations', permission: 'sales.quotations' },
      { title: '반품관리', href: '/sales/returns', permission: 'sales.returns' },
      { title: '단가관리', href: '/sales/pricing', permission: 'sales.pricing' },
    ],
  },
  {
    title: '구매관리',
    href: '/purchasing',
    icon: Truck,
    module: 'purchasing',
    children: [
      { title: '발주관리', href: '/purchasing/orders', permission: 'purchasing.orders' },
      { title: '입고관리', href: '/purchasing/receiving', permission: 'purchasing.receiving' },
      { title: '매입처관리', href: '/purchasing/suppliers', permission: 'purchasing.suppliers' },
      { title: '매입현황', href: '/purchasing/summary', permission: 'purchasing.summary' },
    ],
  },
  {
    title: '생산관리',
    href: '/production',
    icon: Factory,
    module: 'production',
    children: [
      { title: 'OEM 위탁현황', href: '/production/oem', permission: 'production.oem' },
      { title: '배합표(BOM)', href: '/production/bom', permission: 'production.bom' },
      { title: '생산계획', href: '/production/plan', permission: 'production.plan' },
      { title: '생산실적', href: '/production/result', permission: 'production.result' },
    ],
  },
  {
    title: '재고관리',
    href: '/inventory',
    icon: Warehouse,
    module: 'inventory',
    children: [
      { title: '품목관리', href: '/inventory/items', permission: 'inventory.items' },
      { title: '재고현황', href: '/inventory/stock-status', permission: 'inventory.status' },
      { title: '입출고내역', href: '/inventory/stock-movement', permission: 'inventory.stock' },
      { title: '유통기한관리', href: '/inventory/expiry', permission: 'inventory.expiry' },
      { title: 'LOT추적', href: '/inventory/lot-tracking', permission: 'inventory.lot' },
      { title: '창고관리', href: '/inventory/warehouses', permission: 'inventory.warehouses' },
    ],
  },
  {
    title: '품질관리',
    href: '/quality',
    icon: ShieldCheck,
    module: 'quality',
    children: [
      { title: '입고검사', href: '/quality/incoming', permission: 'quality.incoming' },
      { title: '출하검사', href: '/quality/outgoing', permission: 'quality.outgoing' },
      { title: '검사기준', href: '/quality/standards', permission: 'quality.standards' },
    ],
  },
  {
    title: '정산관리',
    href: '/closing',
    icon: CalendarCheck,
    module: 'closing',
    children: [
      { title: '매출정산', href: '/closing/sales-settlement', permission: 'closing.sales' },
      { title: '매입정산', href: '/closing/purchase-settlement', permission: 'closing.purchase' },
      { title: '상계내역', href: '/closing/netting', permission: 'closing.netting' },
      { title: '대금지급', href: '/closing/payments', permission: 'closing.payments' },
    ],
  },
  {
    title: '회계관리',
    href: '/accounting',
    icon: Calculator,
    module: 'accounting',
    children: [
      { title: '전표관리', href: '/accounting/vouchers', permission: 'accounting.vouchers' },
      { title: '총계정원장', href: '/accounting/ledger', permission: 'accounting.ledger' },
      { title: '세금계산서', href: '/accounting/tax-invoice', permission: 'accounting.tax' },
      { title: '분개장', href: '/accounting/journal', permission: 'accounting.journal' },
      { title: '예산관리', href: '/accounting/budget', permission: 'accounting.budget' },
      { title: '재무제표', href: '/accounting/financial-statements', permission: 'accounting.financial' },
    ],
  },
  {
    title: '인사관리',
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
      { title: '회사관리', href: '/admin/company', permission: 'admin.company' },
      { title: '시스템설정', href: '/admin/settings', permission: 'admin.settings' },
    ],
  },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const setOpen = useSidebarStore((s) => s.setOpen)

  const userRecord = session?.user as Record<string, unknown> | undefined
  const userPermissions = useMemo(
    () => (Array.isArray(userRecord?.permissions) ? userRecord.permissions : []),
    [userRecord]
  )
  const userRoles = useMemo(() => (Array.isArray(userRecord?.roles) ? userRecord.roles : []), [userRecord])
  const isAdmin = userRoles.includes('SYSTEM_ADMIN') || userRoles.includes('관리자')

  const hasPermission = useCallback(
    (module: string) =>
      userPermissions.some(
        (p) =>
          typeof p?.module === 'string' &&
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

        const hasModuleAccess = userPermissions.some((p) => p.module === item.module && p.action === 'read')
        if (hasModuleAccess) return item

        if (item.children) {
          const filteredChildren = item.children.filter((child) => {
            if (!child.permission) return hasModuleAccess
            return userPermissions.some((p) => p.module === child.permission && p.action === 'read')
          })
          if (filteredChildren.length === 0) return null
          return { ...item, children: filteredChildren }
        }

        if (hasModuleAccess || hasPermission(item.module)) return item
        return null
      })
      .filter(Boolean) as NavItem[]
  }, [userPermissions, isAdmin, hasPermission])

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth < 1024) setOpen(false)
  }, [setOpen])

  return (
    <nav className="flex flex-col gap-0.5 p-2" aria-label="메인 메뉴">
      {filteredNavItems.map((item) => (
        <NavItemComponent key={item.href} item={item} pathname={pathname} onNavigate={closeMobileSidebar} />
      ))}
    </nav>
  )
}

const NavChildWithChildren = memo(function NavChildWithChildren({
  child,
  pathname,
  onNavigate,
}: {
  child: NavChild
  pathname: string
  onNavigate: () => void
}) {
  const isActive = pathname === child.href || pathname.startsWith(child.href + '/')
  const [isOpen, setIsOpen] = useState(isActive)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center">
        <Link
          href={child.href}
          onClick={onNavigate}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm transition-colors',
            pathname === child.href
              ? 'bg-sidebar-primary/20 text-sidebar-primary font-medium'
              : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
          )}
        >
          {child.title}
        </Link>
        <CollapsibleTrigger className="text-sidebar-foreground/60 hover:text-sidebar-foreground rounded-md p-1">
          <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-sidebar-border ml-3 flex flex-col gap-0.5 border-l pl-3">
          {child.children!.map((sub) => {
            const subActive = pathname === sub.href
            return (
              <Link
                key={sub.href}
                href={sub.href}
                onClick={onNavigate}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs transition-colors',
                  subActive
                    ? 'bg-sidebar-primary/20 text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                )}
              >
                {sub.title}
              </Link>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
})

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
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-sidebar-border mt-1 ml-4 flex flex-col gap-0.5 border-l pl-4">
          {item.children.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
            if (child.children) {
              return <NavChildWithChildren key={child.href} child={child} pathname={pathname} onNavigate={onNavigate} />
            }
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  childActive
                    ? 'bg-sidebar-primary/20 text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'
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
