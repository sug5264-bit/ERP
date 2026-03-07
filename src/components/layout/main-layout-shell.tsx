'use client'

import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { BreadcrumbNav } from '@/components/layout/breadcrumb-nav'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSidebarStore } from '@/stores/sidebar-store'
import { ThemeInitializer } from '@/components/common/theme-initializer'
import { SessionMonitor } from '@/components/common/session-monitor'
import { KeyboardShortcutsHelp } from '@/components/common/keyboard-shortcuts-help'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { useState, useCallback } from 'react'
import { Leaf } from 'lucide-react'

export function MainLayoutShell({ children }: { children: React.ReactNode }) {
  const { isOpen, setOpen } = useSidebarStore()
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false)

  const toggleShortcutsHelp = useCallback(() => {
    setShortcutsHelpOpen((prev) => !prev)
  }, [])

  useKeyboardShortcuts(toggleShortcutsHelp)

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <ThemeInitializer />
      <SessionMonitor />
      <KeyboardShortcutsHelp open={shortcutsHelpOpen} onOpenChange={setShortcutsHelpOpen} />

      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:text-sm"
      >
        본문 바로가기
      </a>

      {isOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - 다크 그린 테마 */}
      <aside
        className={cn(
          'bg-sidebar fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-sidebar-border shadow-xl transition-transform duration-200 will-change-transform motion-reduce:duration-0 lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:duration-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="navigation"
        aria-label="사이드바 메뉴"
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-sidebar-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Leaf className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground text-sm font-bold tracking-tight">웰그린</span>
              <span className="text-sidebar-foreground/50 text-[10px]">Food Distribution ERP</span>
            </div>
          </div>
        </div>
        <ScrollArea className="h-[calc(100dvh-3.5rem)]">
          <SidebarNav />
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main
          id="main-content"
          className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-3 sm:p-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <BreadcrumbNav />
          {children}
        </main>
      </div>
    </div>
  )
}
