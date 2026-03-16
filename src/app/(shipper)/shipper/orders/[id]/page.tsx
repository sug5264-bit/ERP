'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { ShipperLayoutShell } from '@/components/layout/shipper-layout-shell'
import { PageHeader } from '@/components/common/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/common/status-badge'
import { SHIPPER_ORDER_STATUS_LABELS, SHIPPING_METHOD_LABELS } from '@/lib/constants'
import { Package, Clock, Truck, MapPin, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ShipperOrderDetail {
  id: string
  orderNo: string
  orderDate: string
  status: string
  senderName: string
  senderPhone: string | null
  senderAddress: string | null
  recipientName: string
  recipientPhone: string | null
  recipientZipCode: string | null
  recipientAddress: string
  itemName: string
  quantity: number
  weight: number | null
  shippingMethod: string
  specialNote: string | null
  trackingNo: string | null
  carrier: string | null
  assignedDriver: string | null
  assignedDriverPhone: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  createdAt: string
  updatedAt: string
  shipperItem?: {
    id: string
    itemName: string
    itemCode: string
  } | null
}

const STATUS_STEPS = [
  { key: 'RECEIVED', label: '접수', icon: Package },
  { key: 'PROCESSING', label: '처리중', icon: Clock },
  { key: 'SHIPPED', label: '출고', icon: Package },
  { key: 'IN_TRANSIT', label: '배송중', icon: Truck },
  { key: 'DELIVERED', label: '배송완료', icon: CheckCircle2 },
] as const

function getStepDate(order: ShipperOrderDetail, stepKey: string): string | null {
  switch (stepKey) {
    case 'RECEIVED':
      return order.createdAt
    case 'PROCESSING':
      return order.pickedUpAt
    case 'SHIPPED':
      return order.pickedUpAt
    case 'IN_TRANSIT':
      return order.trackingNo ? order.updatedAt : null
    case 'DELIVERED':
      return order.deliveredAt
    default:
      return null
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function StatusTimeline({ order }: { order: ShipperOrderDetail }) {
  const statusIndex = STATUS_STEPS.findIndex((s) => s.key === order.status)
  // RETURNED is a special status - show all as incomplete
  const isReturned = order.status === 'RETURNED'

  return (
    <div className="space-y-0">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = !isReturned && idx <= statusIndex
        const isCurrent = !isReturned && idx === statusIndex
        const Icon = step.icon
        const date = isCompleted ? getStepDate(order, step.key) : null

        return (
          <div key={step.key} className="relative flex gap-3">
            {/* Vertical line */}
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`absolute top-[30px] left-[15px] h-[calc(100%-14px)] w-[2px] ${
                  isCompleted && idx < statusIndex ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
            {/* Dot / Icon */}
            <div
              className={`relative z-10 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border-2 ${
                isCurrent
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isCompleted
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted bg-muted/30 text-muted-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            {/* Content */}
            <div className="flex-1 pb-6">
              <p
                className={`text-sm font-medium ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.label}
                {isCurrent && (
                  <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs">현재</span>
                )}
              </p>
              {date && <p className="text-muted-foreground mt-0.5 text-xs">{formatDateTime(date)}</p>}
              {/* Extra info for specific steps */}
              {step.key === 'IN_TRANSIT' && isCompleted && order.assignedDriver && (
                <p className="text-muted-foreground mt-1 text-xs">
                  배송기사: {order.assignedDriver}
                  {order.assignedDriverPhone && ` (${order.assignedDriverPhone})`}
                </p>
              )}
              {step.key === 'IN_TRANSIT' && isCompleted && order.trackingNo && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  운송장: {order.trackingNo}
                  {order.carrier && ` (${order.carrier})`}
                </p>
              )}
            </div>
          </div>
        )
      })}

      {isReturned && (
        <div className="relative flex gap-3">
          <div className="border-destructive bg-destructive/10 text-destructive relative z-10 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border-2">
            <MapPin className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 pb-6">
            <p className="text-destructive text-sm font-medium">반품</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{formatDateTime(order.updatedAt)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-muted-foreground w-24 flex-shrink-0 text-xs">{label}</span>
      <span className="text-sm">{value ?? '-'}</span>
    </div>
  )
}

export default function ShipperOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<ShipperOrderDetail>({
    queryKey: ['shipper-order', id],
    queryFn: async () => {
      const res = await api.get(`/shipper/orders/${id}`)
      const body = res as { data?: ShipperOrderDetail }
      return (body.data ?? res) as ShipperOrderDetail
    },
    enabled: !!id,
  })

  return (
    <ShipperLayoutShell>
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="주문 상세"
          description={order?.orderNo ?? ''}
          actions={
            <Link href="/shipper/orders">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> 목록
              </Button>
            </Link>
          }
        />

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground text-sm">로딩 중...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-20">
            <p className="text-destructive text-sm">주문 정보를 불러올 수 없습니다.</p>
          </div>
        )}

        {order && (
          <>
            {/* Order header */}
            <Card>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{order.orderNo}</span>
                  <StatusBadge status={order.status} labels={SHIPPER_ORDER_STATUS_LABELS} />
                </div>
                <span className="text-muted-foreground text-sm">주문일: {formatDate(order.orderDate)}</span>
              </CardContent>
            </Card>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Left: Order details */}
              <div className="space-y-4 lg:col-span-2">
                {/* 발송인 */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">발송인 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <InfoRow label="이름" value={order.senderName} />
                    <InfoRow label="전화번호" value={order.senderPhone} />
                    <InfoRow label="주소" value={order.senderAddress} />
                  </CardContent>
                </Card>

                {/* 수취인 */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">수취인 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <InfoRow label="이름" value={order.recipientName} />
                    <InfoRow label="전화번호" value={order.recipientPhone} />
                    <InfoRow label="우편번호" value={order.recipientZipCode} />
                    <InfoRow label="주소" value={order.recipientAddress} />
                  </CardContent>
                </Card>

                {/* 상품 */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">상품 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <InfoRow label="상품명" value={order.itemName} />
                    <InfoRow label="수량" value={order.quantity} />
                    <InfoRow label="중량(kg)" value={order.weight} />
                    {order.shipperItem && (
                      <InfoRow
                        label="품목코드"
                        value={`${order.shipperItem.itemCode} (${order.shipperItem.itemName})`}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* 배송 */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">배송 정보</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <InfoRow
                      label="배송방법"
                      value={SHIPPING_METHOD_LABELS[order.shippingMethod] ?? order.shippingMethod}
                    />
                    <InfoRow label="운송장번호" value={order.trackingNo} />
                    <InfoRow label="택배사" value={order.carrier} />
                    <InfoRow label="배송기사" value={order.assignedDriver} />
                    <InfoRow label="기사 연락처" value={order.assignedDriverPhone} />
                    <InfoRow label="특이사항" value={order.specialNote} />
                  </CardContent>
                </Card>
              </div>

              {/* Right: Status timeline */}
              <div>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">배송 진행 현황</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2">
                    <StatusTimeline order={order} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </ShipperLayoutShell>
  )
}
