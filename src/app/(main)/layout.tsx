'use client'

import { cn } from '@/lib/utils'
import { Header } from '@/components/layout/header'
import { SidebarNav } from '@/components/layout/sidebar-nav'
import { BreadcrumbNav } from '@/components/layout/breadcrumb-nav'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSidebarStore } from '@/stores/sidebar-store'
import { ThemeInitializer } from '@/components/common/theme-initializer'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isOpen, setOpen } = useSidebarStore()

  return (
    <div className="flex h-screen overflow-hidden">
      <ThemeInitializer />

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar - mobile: overlay, desktop: static */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-background transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:w-0 lg:overflow-hidden'
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-bold">ERP</span>
        </div>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <SidebarNav />
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          <BreadcrumbNav />
          {children}
        </main>
      </div>
    </div>
  )
}
