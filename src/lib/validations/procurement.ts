import { z } from 'zod'

// ─── 구매요청 ──────────────────────────────
export const createPurchaseRequestSchema = z.object({
  requestDate: z.string().min(1, '요청일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  departmentId: z.string().min(1, '부서를 선택하세요').max(50),
  reason: z.string().max(1000).optional().nullable(),
  details: z.array(z.object({
    itemId: z.string().min(1, '품목을 선택하세요').max(50),
    quantity: z.number().min(0.01, '수량은 0보다 커야 합니다').max(999_999_999),
    desiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable().or(z.literal('')),
    remark: z.string().max(500).optional().nullable(),
  })).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 발주 ──────────────────────────────────
export const createPurchaseOrderSchema = z.object({
  orderDate: z.string().min(1, '발주일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  purchaseRequestId: z.string().max(50).optional().nullable(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional().nullable().or(z.literal('')),
  description: z.string().max(1000).optional().nullable(),
  details: z.array(z.object({
    itemId: z.string().min(1, '품목을 선택하세요').max(50),
    quantity: z.number().min(0.01, '수량은 0보다 커야 합니다').max(999_999_999),
    unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다').max(999_999_999_999),
    remark: z.string().max(500).optional().nullable(),
  })).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 입고 ──────────────────────────────────
export const createReceivingSchema = z.object({
  receivingDate: z.string().min(1, '입고일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  purchaseOrderId: z.string().min(1, '발주를 선택하세요').max(50),
  details: z.array(z.object({
    itemId: z.string().min(1).max(50),
    orderedQty: z.number().min(0).max(999_999_999),
    receivedQty: z.number().min(0.01).max(999_999_999),
    acceptedQty: z.number().min(0).max(999_999_999),
    rejectedQty: z.number().min(0).max(999_999_999).default(0),
    unitPrice: z.number().min(0).max(999_999_999_999),
  })).min(1, '최소 1개 이상의 품목이 필요합니다').max(100),
})

// ─── 구매대금 ──────────────────────────────
export const createPurchasePaymentSchema = z.object({
  paymentDate: z.string().min(1, '지급일을 입력하세요').regex(/^\d{4}-\d{2}-\d{2}/, '올바른 날짜 형식이 아닙니다'),
  partnerId: z.string().min(1, '거래처를 선택하세요').max(50),
  totalAmount: z.number().min(0.01, '금액은 0보다 커야 합니다').max(999_999_999_999),
  paymentMethod: z.string().max(50).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
})
