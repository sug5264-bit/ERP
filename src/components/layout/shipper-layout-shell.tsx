'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSidebarStore } from '@/stores/sidebar-store'
import { ThemeInitializer } from '@/components/common/theme-initializer'
import { useThemeStore } from '@/stores/theme-store'
import {
  LayoutDashboard,
  PackagePlus,
  Truck,
  Receipt,
  Bell,
  LogOut,
  Moon,
  Sun,
  Menu,
  Leaf,
  type LucideIcon,
} from 'lucide-react'

interface ShipperNavItem {
  title: string
  href: string
  icon: LucideIcon
}

const shipperNavItems: ShipperNavItem[] = [
  { title: '대시보드', href: '/shipper/dashboard', icon: LayoutDashboard },
  { title: '주문등록', href: '/shipper/orders/new', icon: PackagePlus },
  { title: '배송현황', href: '/shipper/orders', icon: Truck },
  { title: '정산내역', href: '/shipper/settlement', icon: Receipt },
  { title: '공지사항', href: '/shipper/notices', icon: Bell },
]

export function ShipperLayoutShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { isOpen, toggle, setOpen } = useSidebarStore()
  const { theme, toggle: toggleTheme } = useThemeStore()

  const user = session?.user
  const userRecord = user as Record<string, unknown> | undefined
  const initials = user?.name?.slice(0, 2)?.toUpperCase() || 'U'

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <ThemeInitializer />

      {isOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          'bg-sidebar border-sidebar-border fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] border-r shadow-xl transition-transform duration-200 will-change-transform lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:duration-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="border-sidebar-border flex h-14 items-center border-b px-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-sidebar-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Leaf className="text-sidebar-primary-foreground h-4.5 w-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground text-sm font-bold">화주사 포털</span>
              <span className="text-sidebar-foreground/50 text-[10px]">
                {((userRecord as Record<string, unknown>)?.companyName as string) || '웰그린 3PL'}
              </span>
            </div>
          </div>
        </div>
        <ScrollArea className="h-[calc(100dvh-3.5rem)]">
          <nav className="flex flex-col gap-0.5 p-2">
            {shipperNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (window.innerWidth < 1024) setOpen(false)
                  }}
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
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* 메인 */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-2 sm:gap-4 sm:px-4">
          <Button variant="ghost" size="icon" onClick={toggle} className="shrink-0 lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="text-sm font-semibold">
            {shipperNavItems.find((i) => pathname.startsWith(i.href))?.title || '화주사 포털'}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-muted-foreground text-xs">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                  <LogOut className="mr-2 h-4 w-4" /> 로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main
          className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:p-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
