import { describe, it, expect } from 'vitest'
import {
  createSalesOrderSchema,
  createPurchaseOrderSchema,
  createDeliverySchema,
  createSalesReturnSchema,
  createQuotationSchema,
  createReceivingSchema,
  createQualityInspectionSchema,
  createNettingSchema,
} from '@/lib/validations/sales'

describe('createSalesOrderSchema', () => {
  const validOrder = {
    orderDate: '2024-06-15',
    partnerId: 'partner-1',
    details: [{ itemId: 'item-1', quantity: 10, unitPrice: 1000 }],
  }

  it('유효한 수주 데이터 통과', () => {
    const result = createSalesOrderSchema.safeParse(validOrder)
    expect(result.success).toBe(true)
  })

  it('발주일 필수', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, orderDate: '' })
    expect(result.success).toBe(false)
  })

  it('잘못된 날짜 형식 거부', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, orderDate: '2024/06/15' })
    expect(result.success).toBe(false)
  })

  it('상세 항목 최소 1개 필수', () => {
    const result = createSalesOrderSchema.safeParse({ ...validOrder, details: [] })
    expect(result.success).toBe(false)
  })

  it('상세 항목 최대 100개', () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => ({
      itemId: `item-${i}`,
      quantity: 1,
      unitPrice: 100,
    }))
    const result = createSalesOrderSchema.safeParse({ ...validOrder, details: tooMany })
    expect(result.success).toBe(false)
  })

  it('수량은 0보다 커야 함', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      details: [{ itemId: 'item-1', quantity: 0, unitPrice: 1000 }],
    })
    expect(result.success).toBe(false)
  })

  it('단가는 0 이상이어야 함', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      details: [{ itemId: 'item-1', quantity: 10, unitPrice: -100 }],
    })
    expect(result.success).toBe(false)
  })

  it('itemId 또는 itemName 중 하나는 필수', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      details: [{ quantity: 10, unitPrice: 1000 }],
    })
    expect(result.success).toBe(false)
  })

  it('itemName으로도 통과 (자동 생성용)', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      details: [{ itemName: '새품목', quantity: 10, unitPrice: 1000 }],
    })
    expect(result.success).toBe(true)
  })

  it('salesChannel 기본값 OFFLINE', () => {
    const result = createSalesOrderSchema.safeParse(validOrder)
    if (result.success) {
      expect(result.data.salesChannel).toBe('OFFLINE')
    }
  })

  it('vatIncluded 기본값 true', () => {
    const result = createSalesOrderSchema.safeParse(validOrder)
    if (result.success) {
      expect(result.data.vatIncluded).toBe(true)
    }
  })

  it('이커머스 필드 선택적', () => {
    const result = createSalesOrderSchema.safeParse({
      ...validOrder,
      salesChannel: 'ONLINE',
      siteName: '쿠팡',
      ordererName: '홍길동',
      recipientName: '김철수',
      recipientAddress: '서울시 강남구',
      shippingCost: 3000,
    })
    expect(result.success).toBe(true)
  })
})

describe('createPurchaseOrderSchema', () => {
  const validPO = {
    orderDate: '2024-06-15',
    partnerId: 'partner-1',
    details: [{ itemId: 'item-1', quantity: 50, unitPrice: 500 }],
  }

  it('유효한 구매발주 통과', () => {
    const result = createPurchaseOrderSchema.safeParse(validPO)
    expect(result.success).toBe(true)
  })

  it('거래처 ID 또는 거래처명 필수', () => {
    const result = createPurchaseOrderSchema.safeParse({
      orderDate: '2024-06-15',
      details: [{ itemId: 'item-1', quantity: 50, unitPrice: 500 }],
    })
    expect(result.success).toBe(false)
  })

  it('partnerName으로도 통과 (자동 거래처 생성)', () => {
    const result = createPurchaseOrderSchema.safeParse({
      orderDate: '2024-06-15',
      partnerName: '새거래처',
      details: [{ itemId: 'item-1', quantity: 50, unitPrice: 500 }],
    })
    expect(result.success).toBe(true)
  })
})

describe('createDeliverySchema', () => {
  it('유효한 납품 데이터 통과', () => {
    const result = createDeliverySchema.safeParse({
      deliveryDate: '2024-06-20',
      salesOrderId: 'so-1',
      details: [{ itemId: 'item-1', quantity: 5, unitPrice: 1000 }],
    })
    expect(result.success).toBe(true)
  })

  it('발주 ID 필수', () => {
    const result = createDeliverySchema.safeParse({
      deliveryDate: '2024-06-20',
      salesOrderId: '',
      details: [{ itemId: 'item-1', quantity: 5, unitPrice: 1000 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('createSalesReturnSchema', () => {
  it('유효한 반품 데이터 통과', () => {
    const result = createSalesReturnSchema.safeParse({
      returnDate: '2024-07-01',
      salesOrderId: 'so-1',
      reason: 'DEFECT',
      reasonDetail: '불량품 수령',
    })
    expect(result.success).toBe(true)
  })

  it('반품 사유 enum 검증', () => {
    const validReasons = ['DEFECT', 'WRONG_ITEM', 'CUSTOMER_CHANGE', 'QUALITY_ISSUE', 'OTHER']
    for (const reason of validReasons) {
      const result = createSalesReturnSchema.safeParse({
        returnDate: '2024-07-01',
        salesOrderId: 'so-1',
        reason,
      })
      expect(result.success).toBe(true)
    }
  })

  it('잘못된 사유 거부', () => {
    const result = createSalesReturnSchema.safeParse({
      returnDate: '2024-07-01',
      salesOrderId: 'so-1',
      reason: 'INVALID_REASON',
    })
    expect(result.success).toBe(false)
  })
})

describe('createQuotationSchema', () => {
  it('유효한 견적 데이터 통과', () => {
    const result = createQuotationSchema.safeParse({
      quotationDate: '2024-06-01',
      partnerId: 'partner-1',
      validUntil: '2024-07-01',
      details: [{ itemId: 'item-1', quantity: 100, unitPrice: 2000 }],
    })
    expect(result.success).toBe(true)
  })

  it('유효기간 비어있어도 통과', () => {
    const result = createQuotationSchema.safeParse({
      quotationDate: '2024-06-01',
      partnerId: 'partner-1',
      validUntil: '',
      details: [{ itemId: 'item-1', quantity: 100, unitPrice: 2000 }],
    })
    expect(result.success).toBe(true)
  })
})

describe('createReceivingSchema', () => {
  it('유효한 입고 데이터 통과', () => {
    const result = createReceivingSchema.safeParse({
      receivingDate: '2024-06-20',
      purchaseOrderId: 'po-1',
      details: [{ itemId: 'item-1', quantity: 30, unitPrice: 500 }],
    })
    expect(result.success).toBe(true)
  })

  it('유통기한 및 LOT번호 선택적', () => {
    const result = createReceivingSchema.safeParse({
      receivingDate: '2024-06-20',
      purchaseOrderId: 'po-1',
      details: [
        {
          itemId: 'item-1',
          quantity: 30,
          unitPrice: 500,
          lotNo: 'LOT-20240620',
          expiryDate: '2025-06-20',
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('createQualityInspectionSchema', () => {
  it('유효한 품질검사 데이터 통과', () => {
    const result = createQualityInspectionSchema.safeParse({
      deliveryId: 'dlv-1',
      inspectionDate: '2024-06-21',
      inspectorName: '김검사',
      overallGrade: 'A',
      sampleSize: 100,
      defectCount: 2,
      judgement: 'PASS',
      items: [
        {
          category: '외관',
          checkItem: '표면 상태',
          spec: '이물질 없음',
          result: 'PASS',
          grade: 'A',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('검사항목 최소 1개 필수', () => {
    const result = createQualityInspectionSchema.safeParse({
      deliveryId: 'dlv-1',
      inspectionDate: '2024-06-21',
      inspectorName: '김검사',
      items: [],
    })
    expect(result.success).toBe(false)
  })

  it('등급 enum 검증', () => {
    for (const grade of ['A', 'B', 'C', 'REJECT']) {
      const result = createQualityInspectionSchema.safeParse({
        deliveryId: 'dlv-1',
        inspectionDate: '2024-06-21',
        inspectorName: '김검사',
        overallGrade: grade,
        items: [{ category: '외관', checkItem: '검사', result: 'PASS', grade: 'A' }],
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('createNettingSchema', () => {
  it('유효한 상계 데이터 통과', () => {
    const result = createNettingSchema.safeParse({
      partnerId: 'partner-1',
      amount: 100000,
      nettingDate: '2024-06-30',
      description: '6월분 상계 처리',
    })
    expect(result.success).toBe(true)
  })

  it('금액 0 이하 거부', () => {
    const result = createNettingSchema.safeParse({
      partnerId: 'partner-1',
      amount: 0,
      nettingDate: '2024-06-30',
    })
    expect(result.success).toBe(false)
  })
})
