'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Bell, LogOut, Menu, User, Moon, Sun, Star, StarOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useThemeStore } from '@/stores/theme-store'
import { useFavoritesStore } from '@/stores/favorites-store'
import { APP_NAME } from '@/lib/constants'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '대시보드',
  '/accounting/vouchers': '전표관리',
  '/accounting/journal': '분개장',
  '/accounting/ledger': '총계정원장',
  '/accounting/financial-statements': '재무제표',
  '/accounting/tax-invoice': '세금계산서',
  '/accounting/budget': '예산관리',
  '/hr/employees': '사원관리',
  '/hr/organization': '부서/직급',
  '/hr/attendance': '근태관리',
  '/hr/leave': '휴가관리',
  '/hr/payroll': '급여관리',
  '/hr/recruitment': '채용관리',
  '/inventory/items': '품목관리',
  '/inventory/stock-movement': '입출고',
  '/inventory/stock-status': '재고현황',
  '/inventory/warehouses': '창고관리',
  '/sales/summary': '매출집계',
  '/sales/partners': '거래처관리',
  '/sales/quotations': '견적관리',
  '/sales/orders': '발주관리',
  '/sales/deliveries': '납품관리',
  '/approval/draft': '기안하기',
  '/approval/pending': '결재대기',
  '/approval/completed': '결재완료',
  '/approval/rejected': '반려문서',
  '/board/notices': '공지사항',
  '/board/general': '자유게시판',
  '/board/messages': '사내메시지',
  '/admin/users': '사용자관리',
  '/admin/roles': '권한관리',
  '/admin/codes': '코드관리',
  '/admin/logs': '감사로그',
}

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const toggle = useSidebarStore((s) => s.toggle)
  const { theme, toggle: toggleTheme } = useThemeStore()
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritesStore()

  const user = session?.user
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U'

  const pageTitle = PAGE_TITLES[pathname]
  const canFavorite = !!pageTitle && pathname !== '/dashboard'
  const isCurrentFav = isFavorite(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
      <Button variant="ghost" size="icon" onClick={toggle} className="lg:hidden">
        <Menu className="h-5 w-5" />
      </Button>

      <div className="hidden font-semibold lg:block">{APP_NAME}</div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="hidden lg:flex items-center gap-1 ml-4">
          {favorites.map((fav) => (
            <Link key={fav.href} href={fav.href}>
              <Button
                variant={pathname === fav.href ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
              >
                <Star className="mr-1 h-3 w-3 fill-yellow-400 text-yellow-400" />
                {fav.title}
              </Button>
            </Link>
          ))}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Favorite toggle */}
        {canFavorite && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isCurrentFav) removeFavorite(pathname)
              else addFavorite({ title: pageTitle, href: pathname })
            }}
            title={isCurrentFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          >
            {isCurrentFav ? (
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Dark mode toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(user as any)?.departmentName} / {(user as any)?.positionName}
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              내 정보
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
