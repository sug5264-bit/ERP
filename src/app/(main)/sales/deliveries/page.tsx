'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DeliveriesRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/sales/deliveries/order-tracking')
  }, [router])

  return null
}
