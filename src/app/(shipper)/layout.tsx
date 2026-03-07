import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function ShipperLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const user = session.user as Record<string, unknown>
  if (user.accountType !== 'SHIPPER') redirect('/dashboard')

  return <>{children}</>
}
