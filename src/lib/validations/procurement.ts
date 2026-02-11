import { z } from 'zod'

// ─── 구매요청 ──────────────────────────────
export const createPurchaseRequestSchema = z.object({
  requestDate: z.string().min(1, '요청일을 입력하세요'),
  departmentId: z.string().min(1, '부서를 선택하세요'),
  reason: z.string().optional().nullable(),
  details: z.array(z.object({
    itemId: z.string().min(1, '품목을 선택하세요'),
    quantity: z.number().min(0.01, '수량은 0보다 커야 합니다'),
    desiredDate: z.string().optional().nullable(),
    remark: z.string().optional().nullable(),
  })).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 발주 ──────────────────────────────────
export const createPurchaseOrderSchema = z.object({
  orderDate: z.string().min(1, '발주일을 입력하세요'),
  partnerId: z.string().min(1, '거래처를 선택하세요'),
  purchaseRequestId: z.string().optional().nullable(),
  deliveryDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  details: z.array(z.object({
    itemId: z.string().min(1, '품목을 선택하세요'),
    quantity: z.number().min(0.01, '수량은 0보다 커야 합니다'),
    unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다'),
    remark: z.string().optional().nullable(),
  })).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 입고 ──────────────────────────────────
export const createReceivingSchema = z.object({
  receivingDate: z.string().min(1, '입고일을 입력하세요'),
  purchaseOrderId: z.string().min(1, '발주를 선택하세요'),
  details: z.array(z.object({
    itemId: z.string().min(1),
    orderedQty: z.number().min(0),
    receivedQty: z.number().min(0.01),
    acceptedQty: z.number().min(0),
    rejectedQty: z.number().min(0).default(0),
    unitPrice: z.number().min(0),
  })).min(1, '최소 1개 이상의 품목이 필요합니다'),
})

// ─── 구매대금 ──────────────────────────────
export const createPurchasePaymentSchema = z.object({
  paymentDate: z.string().min(1, '지급일을 입력하세요'),
  partnerId: z.string().min(1, '거래처를 선택하세요'),
  totalAmount: z.number().min(0.01, '금액은 0보다 커야 합니다'),
  paymentMethod: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})
