'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { OrdersPanel } from '@/components/sales/orders-panel'
import { DeliveriesPanel } from '@/components/sales/deliveries-panel'

export default function OrderShipmentPage() {
  const [mainTab, setMainTab] = useState<string>('orders')

  return (
    <div className="space-y-6">
      <PageHeader title="수주/출하 통합관리" description="수주 등록부터 출하/납품까지 통합 관리합니다" />
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="orders">수주관리</TabsTrigger>
          <TabsTrigger value="deliveries">출하관리</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          <OrdersPanel />
        </TabsContent>
        <TabsContent value="deliveries">
          <DeliveriesPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
