import { MainLayoutShell } from '@/components/layout/main-layout-shell'

export const dynamic = 'force-dynamic'

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <MainLayoutShell>{children}</MainLayoutShell>
}
