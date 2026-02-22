'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Menu, User, Moon, Sun, Star, StarOff, Search, X, Users, Package, ShoppingCart, FileText, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { NotificationBell } from '@/components/layout/notification-bell'
import { APP_NAME } from '@/lib/constants'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { api } from '@/hooks/use-api'

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
  '/sales/returns': '반품관리',
  '/closing/netting': '상계내역',
  '/closing/payments': '대금지급',
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
  '/admin/company': '회사관리',
  '/mypage': '마이페이지',
  '/projects': '프로젝트',
}

const SEARCHABLE_PAGES = Object.entries(PAGE_TITLES).map(([href, title]) => ({ href, title }))

const TYPE_ICON_MAP: Record<string, typeof Users> = {
  employee: Users,
  partner: ShoppingCart,
  item: Package,
  voucher: FileText,
  project: FolderKanban,
}

const TYPE_LABEL_MAP: Record<string, string> = {
  employee: '사원',
  partner: '거래처',
  item: '품목',
  voucher: '전표',
  project: '프로젝트',
}

export function Header() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const toggle = useSidebarStore((s) => s.toggle)
  const { theme, toggle: toggleTheme } = useThemeStore()
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoritesStore()
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dataResults, setDataResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // 메뉴 검색 결과
  const menuResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase()
    return SEARCHABLE_PAGES.filter(
      (p) => p.title.toLowerCase().includes(q) || p.href.toLowerCase().includes(q)
    ).slice(0, 5)
  }, [searchQuery])

  // 데이터 검색 (debounced)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setDataResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}&limit=3`)
        if (res.data?.results) {
          const all: any[] = []
          for (const items of Object.values(res.data.results)) {
            if (Array.isArray(items)) all.push(...items)
          }
          setDataResults(all.slice(0, 8))
        }
      } catch {
        setDataResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery])

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  // 데스크톱 검색 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearchNavigate = useCallback((href: string) => {
    router.push(href)
    setSearchOpen(false)
    setSearchQuery('')
    setDataResults([])
  }, [router])

  const hasResults = menuResults.length > 0 || dataResults.length > 0

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 sm:gap-4 border-b bg-background px-2 sm:px-4">
        <Button variant="ghost" size="icon" onClick={toggle} className="lg:hidden shrink-0" aria-label="메뉴 토글">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="font-semibold text-sm lg:text-base truncate min-w-0">{pageTitle || APP_NAME}</div>

        {/* Favorites - desktop only */}
        {!isMobile && favorites.length > 0 && (
          <div className="hidden xl:flex items-center gap-1 ml-2">
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

        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          {/* 통합 검색 - 모바일 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            title="통합 검색 (Ctrl+K)"
            aria-label="통합 검색"
            className="lg:hidden shrink-0"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* 통합 검색 - 데스크톱 */}
          <div ref={searchContainerRef} className="hidden lg:block relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="통합 검색... (Ctrl+K)"
              aria-label="통합 검색"
              className="w-64 pl-8 pr-8 h-8 text-sm"
              onFocus={() => setSearchOpen(true)}
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-8 w-8"
                onClick={() => { setSearchQuery(''); setDataResults([]); searchRef.current?.focus() }}>
                <X className="h-3 w-3" />
              </Button>
            )}
            {searchOpen && searchQuery && (
              <div className="absolute top-full left-0 w-96 mt-1 bg-background border rounded-md shadow-lg z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
                {menuResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">메뉴</div>
                    {menuResults.map((r) => (
                      <button key={r.href} onClick={() => handleSearchNavigate(r.href)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none transition-colors flex items-center gap-2">
                        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="font-medium">{r.title}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{r.href}</span>
                      </button>
                    ))}
                  </>
                )}
                {dataResults.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-t">데이터</div>
                    {dataResults.map((r) => {
                      const Icon = TYPE_ICON_MAP[r.type] || Search
                      return (
                        <button key={`${r.type}-${r.id}`} onClick={() => handleSearchNavigate(r.url)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none transition-colors flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium truncate block">{r.title}</span>
                            {r.subtitle && <span className="text-xs text-muted-foreground truncate block">{r.subtitle}</span>}
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {TYPE_LABEL_MAP[r.type] || r.type}
                          </Badge>
                        </button>
                      )
                    })}
                  </>
                )}
                {isSearching && (
                  <div className="p-3 text-sm text-muted-foreground text-center">검색 중...</div>
                )}
                {!isSearching && !hasResults && searchQuery.length >= 2 && (
                  <div className="p-3 text-sm text-muted-foreground text-center">검색 결과 없음</div>
                )}
              </div>
            )}
          </div>

          {/* Favorite toggle */}
          {canFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex shrink-0"
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
          <Button variant="ghost" size="icon" onClick={toggleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'} aria-label={theme === 'dark' ? '라이트 모드' : '다크 모드'} className="shrink-0">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* 알림 */}
          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full shrink-0">
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
              <DropdownMenuItem onClick={() => router.push('/mypage')}>
                <User className="mr-2 h-4 w-4" />
                마이페이지
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

      {/* 모바일 검색 오버레이 */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-background lg:hidden">
          <div className="flex items-center gap-2 p-3 border-b">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="통합 검색..."
              className="flex-1 border-0 shadow-none focus-visible:ring-0 text-base"
            />
            <Button variant="ghost" size="sm" onClick={() => { setSearchOpen(false); setSearchQuery(''); setDataResults([]) }}>
              취소
            </Button>
          </div>
          <div className="overflow-y-auto max-h-[calc(100dvh-60px)]">
            {menuResults.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">메뉴</div>
                {menuResults.map((r) => (
                  <button key={r.href} onClick={() => handleSearchNavigate(r.href)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors flex items-center gap-3 border-b">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.href}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
            {dataResults.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/50">데이터</div>
                {dataResults.map((r) => {
                  const Icon = TYPE_ICON_MAP[r.type] || Search
                  return (
                    <button key={`${r.type}-${r.id}`} onClick={() => handleSearchNavigate(r.url)}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-accent transition-colors flex items-center gap-3 border-b">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{r.subtitle}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {TYPE_LABEL_MAP[r.type] || r.type}
                      </Badge>
                    </button>
                  )
                })}
              </>
            )}
            {isSearching && (
              <div className="p-6 text-center text-sm text-muted-foreground">검색 중...</div>
            )}
            {!isSearching && !hasResults && searchQuery.length >= 2 && (
              <div className="p-6 text-center text-sm text-muted-foreground">검색 결과 없음</div>
            )}
            {!searchQuery && (
              <div className="p-4 space-y-1">
                <p className="text-xs text-muted-foreground px-2 pb-2">자주 찾는 메뉴</p>
                {['/dashboard', '/approval/pending', '/hr/leave', '/inventory/items', '/sales/orders'].map((href) => (
                  <button key={href} onClick={() => handleSearchNavigate(href)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent rounded-md transition-colors">
                    {PAGE_TITLES[href] || href}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
