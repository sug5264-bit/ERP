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

export function MainLayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
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

      {/* 접근성: 본문 바로가기 */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:text-sm"
      >
        본문 바로가기
      </a>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - mobile: 좁은 오버레이, desktop: 고정 */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r bg-background transition-transform duration-200 will-change-transform lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:duration-0 motion-reduce:duration-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-bold">ERP</span>
        </div>
        <ScrollArea className="h-[calc(100dvh-3.5rem)]">
          <SidebarNav />
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <BreadcrumbNav />
          {children}
        </main>
      </div>
    </div>
  )
}
