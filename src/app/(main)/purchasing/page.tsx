'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PurchasingRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/purchasing/orders')
  }, [router])

  return null
}
