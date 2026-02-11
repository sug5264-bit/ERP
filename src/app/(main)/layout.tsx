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
  const isOpen = useSidebarStore((s) => s.isOpen)

  return (
    <div className="flex h-screen overflow-hidden">
      <ThemeInitializer />
      {/* Sidebar */}
      <aside
        className={cn(
          'hidden border-r bg-background transition-all duration-300 lg:block',
          isOpen ? 'w-64' : 'w-0 overflow-hidden'
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
        <main className="flex-1 overflow-y-auto p-6">
          <BreadcrumbNav />
          {children}
        </main>
      </div>
    </div>
  )
}
