'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ProductionRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/production/oem')
  }, [router])

  return null
}
