import { describe, it, expect } from 'vitest'
import {
  createSalesOrderSchema,
  createDeliverySchema,
  createQuotationSchema,
  createSalesReturnSchema,
  createQualityInspectionSchema,
  createNettingSchema,
} from '@/lib/validations/sales'
import {
  createItemSchema,
  createWarehouseSchema,
  createStockMovementSchema,
  createPartnerSchema,
} from '@/lib/validations/inventory'
import {
  createVoucherSchema,
  createTaxInvoiceSchema,
  createAccountSubjectSchema,
  createBudgetSchema,
} from '@/lib/validations/accounting'

// ────────────────────────────────────────────
// 영업 (Sales) Validations
// ────────────────────────────────────────────

describe('Sales Validations', () => {
  describe('createSalesOrderSchema', () => {
    const validOrder = {
      orderDate: '2024-06-15',
      details: [{ itemId: 'item-1', quantity: 10, unitPrice: 5000 }],
    }

    it('최소 필수 필드만으로 유효한 수주 생성', () => {
      const result = createSalesOrderSchema.safeParse(validOrder)
      expect(result.success).toBe(true)
    })

    it('주문일 누락 시 실패', () => {
      const result = createSalesOrderSchema.safeParse({ ...validOrder, orderDate: '' })
      expect(result.success).toBe(false)
    })

    it('잘못된 날짜 형식 시 실패', () => {
      const result = createSalesOrderSchema.safeParse({ ...validOrder, orderDate: '15/06/2024' })
      expect(result.success).toBe(false)
    })

    it('품목 비어있으면 실패', () => {
      const result = createSalesOrderSchema.safeParse({ ...validOrder, details: [] })
      expect(result.success).toBe(false)
    })

    it('수량 0 이하 시 실패', () => {
      const result = createSalesOrderSchema.safeParse({
        ...validOrder,
        details: [{ itemId: 'item-1', quantity: 0, unitPrice: 5000 }],
      })
      expect(result.success).toBe(false)
    })

    it('단가 음수 시 실패', () => {
      const result = createSalesOrderSchema.safeParse({
        ...validOrder,
        details: [{ itemId: 'item-1', quantity: 10, unitPrice: -100 }],
      })
      expect(result.success).toBe(false)
    })

    it('e-커머스 필드 포함 유효', () => {
      const result = createSalesOrderSchema.safeParse({
        ...validOrder,
        salesChannel: 'ONLINE',
        siteName: '쿠팡',
        ordererName: '홍길동',
        recipientName: '김철수',
        recipientAddress: '서울시 강남구',
      })
      expect(result.success).toBe(true)
    })

    it('100개 초과 품목 시 실패', () => {
      const details = Array.from({ length: 101 }, (_, i) => ({
        itemId: `item-${i}`,
        quantity: 1,
        unitPrice: 100,
      }))
      const result = createSalesOrderSchema.safeParse({ ...validOrder, details })
      expect(result.success).toBe(false)
    })

    it('partnerId 선택적(nullable)', () => {
      const result = createSalesOrderSchema.safeParse({ ...validOrder, partnerId: null })
      expect(result.success).toBe(true)
    })

    it('vatIncluded 기본값 true', () => {
      const result = createSalesOrderSchema.parse(validOrder)
      expect(result.vatIncluded).toBe(true)
    })
  })

  describe('createDeliverySchema', () => {
    const validDelivery = {
      deliveryDate: '2024-06-20',
      salesOrderId: 'so-1',
      details: [{ itemId: 'item-1', quantity: 5, unitPrice: 5000 }],
    }

    it('유효한 납품 생성', () => {
      const result = createDeliverySchema.safeParse(validDelivery)
      expect(result.success).toBe(true)
    })

    it('수주 ID 누락 시 실패', () => {
      const result = createDeliverySchema.safeParse({ ...validDelivery, salesOrderId: '' })
      expect(result.success).toBe(false)
    })

    it('납품 품목 비어있으면 실패', () => {
      const result = createDeliverySchema.safeParse({ ...validDelivery, details: [] })
      expect(result.success).toBe(false)
    })
  })

  describe('createQuotationSchema', () => {
    const validQuotation = {
      quotationDate: '2024-06-10',
      partnerId: 'partner-1',
      details: [{ itemId: 'item-1', quantity: 100, unitPrice: 10000 }],
    }

    it('유효한 견적 생성', () => {
      const result = createQuotationSchema.safeParse(validQuotation)
      expect(result.success).toBe(true)
    })

    it('거래처 ID 필수', () => {
      const result = createQuotationSchema.safeParse({ ...validQuotation, partnerId: '' })
      expect(result.success).toBe(false)
    })

    it('유효기한 빈 문자열 허용', () => {
      const result = createQuotationSchema.safeParse({ ...validQuotation, validUntil: '' })
      expect(result.success).toBe(true)
    })
  })

  describe('createSalesReturnSchema', () => {
    const validReturn = {
      returnDate: '2024-07-01',
      salesOrderId: 'so-1',
      partnerId: 'partner-1',
    }

    it('유효한 반품 생성', () => {
      const result = createSalesReturnSchema.safeParse(validReturn)
      expect(result.success).toBe(true)
    })

    it('reason 기본값 OTHER', () => {
      const result = createSalesReturnSchema.parse(validReturn)
      expect(result.reason).toBe('OTHER')
    })

    it('잘못된 reason enum 시 실패', () => {
      const result = createSalesReturnSchema.safeParse({ ...validReturn, reason: 'INVALID' })
      expect(result.success).toBe(false)
    })
  })

  describe('createQualityInspectionSchema', () => {
    const validInspection = {
      deliveryId: 'dlv-1',
      inspectionDate: '2024-07-05',
      inspectorName: '검사원A',
      items: [{ category: '외관', checkItem: '스크래치', result: 'PASS', grade: 'A' }],
    }

    it('유효한 품질검사 생성', () => {
      const result = createQualityInspectionSchema.safeParse(validInspection)
      expect(result.success).toBe(true)
    })

    it('검사항목 비어있으면 실패', () => {
      const result = createQualityInspectionSchema.safeParse({ ...validInspection, items: [] })
      expect(result.success).toBe(false)
    })

    it('검사자명 필수', () => {
      const result = createQualityInspectionSchema.safeParse({ ...validInspection, inspectorName: '' })
      expect(result.success).toBe(false)
    })

    it('결함수가 음수 시 실패', () => {
      const result = createQualityInspectionSchema.safeParse({ ...validInspection, defectCount: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('createNettingSchema', () => {
    it('유효한 상계 생성', () => {
      const result = createNettingSchema.safeParse({
        partnerId: 'partner-1',
        amount: 100000,
        nettingDate: '2024-07-10',
      })
      expect(result.success).toBe(true)
    })

    it('금액 0 이하 시 실패', () => {
      const result = createNettingSchema.safeParse({
        partnerId: 'partner-1',
        amount: 0,
        nettingDate: '2024-07-10',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ────────────────────────────────────────────
// 재고 (Inventory) Validations
// ────────────────────────────────────────────

describe('Inventory Validations', () => {
  describe('createItemSchema', () => {
    const validItem = {
      itemCode: 'ITEM-001',
      itemName: '테스트 품목',
    }

    it('최소 필수 필드만으로 유효한 품목 생성', () => {
      const result = createItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('품목코드 특수문자 시 실패', () => {
      const result = createItemSchema.safeParse({ ...validItem, itemCode: 'ITEM@001' })
      expect(result.success).toBe(false)
    })

    it('품목코드 빈 문자열 시 실패', () => {
      const result = createItemSchema.safeParse({ ...validItem, itemCode: '' })
      expect(result.success).toBe(false)
    })

    it('기본값이 올바르게 설정됨', () => {
      const result = createItemSchema.parse(validItem)
      expect(result.unit).toBe('EA')
      expect(result.standardPrice).toBe(0)
      expect(result.safetyStock).toBe(0)
      expect(result.itemType).toBe('GOODS')
      expect(result.taxType).toBe('TAXABLE')
      expect(result.isActive).toBe(true)
    })

    it('모든 itemType enum 값 허용', () => {
      for (const type of ['RAW_MATERIAL', 'PRODUCT', 'GOODS', 'SUBSIDIARY']) {
        const result = createItemSchema.safeParse({ ...validItem, itemType: type })
        expect(result.success).toBe(true)
      }
    })

    it('잘못된 itemType 시 실패', () => {
      const result = createItemSchema.safeParse({ ...validItem, itemType: 'INVALID' })
      expect(result.success).toBe(false)
    })

    it('안전재고 음수 시 실패', () => {
      const result = createItemSchema.safeParse({ ...validItem, safetyStock: -1 })
      expect(result.success).toBe(false)
    })
  })

  describe('createWarehouseSchema', () => {
    it('유효한 창고 생성', () => {
      const result = createWarehouseSchema.safeParse({
        code: 'WH-01',
        name: '제1창고',
      })
      expect(result.success).toBe(true)
    })

    it('창고코드 특수문자 시 실패', () => {
      const result = createWarehouseSchema.safeParse({
        code: 'WH 01',
        name: '제1창고',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('createStockMovementSchema', () => {
    const validMovement = {
      movementDate: '2024-06-15',
      movementType: 'INBOUND' as const,
      targetWarehouseId: 'wh-1',
      details: [{ itemId: 'item-1', quantity: 100 }],
    }

    it('유효한 입고 생성', () => {
      const result = createStockMovementSchema.safeParse(validMovement)
      expect(result.success).toBe(true)
    })

    it('수량 0 이하 시 실패', () => {
      const result = createStockMovementSchema.safeParse({
        ...validMovement,
        details: [{ itemId: 'item-1', quantity: 0 }],
      })
      expect(result.success).toBe(false)
    })

    it('품목 비어있으면 실패', () => {
      const result = createStockMovementSchema.safeParse({ ...validMovement, details: [] })
      expect(result.success).toBe(false)
    })

    it('모든 movementType enum 허용', () => {
      for (const type of ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT']) {
        const result = createStockMovementSchema.safeParse({ ...validMovement, movementType: type })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('createPartnerSchema', () => {
    const validPartner = {
      partnerCode: 'P-001',
      partnerName: '테스트 거래처',
    }

    it('유효한 거래처 생성', () => {
      const result = createPartnerSchema.safeParse(validPartner)
      expect(result.success).toBe(true)
    })

    it('사업자번호 형식 검증 (000-00-00000)', () => {
      const result = createPartnerSchema.safeParse({ ...validPartner, bizNo: '123-45-67890' })
      expect(result.success).toBe(true)
    })

    it('사업자번호 형식 오류 시 실패', () => {
      const result = createPartnerSchema.safeParse({ ...validPartner, bizNo: '12345' })
      expect(result.success).toBe(false)
    })

    it('사업자번호 빈 문자열 허용', () => {
      const result = createPartnerSchema.safeParse({ ...validPartner, bizNo: '' })
      expect(result.success).toBe(true)
    })

    it('이메일 형식 검증', () => {
      const validEmail = createPartnerSchema.safeParse({ ...validPartner, email: 'test@test.com' })
      expect(validEmail.success).toBe(true)

      const invalidEmail = createPartnerSchema.safeParse({ ...validPartner, email: 'invalid-email' })
      expect(invalidEmail.success).toBe(false)
    })

    it('이메일 빈 문자열 허용', () => {
      const result = createPartnerSchema.safeParse({ ...validPartner, email: '' })
      expect(result.success).toBe(true)
    })

    it('기본 partnerType은 BOTH', () => {
      const result = createPartnerSchema.parse(validPartner)
      expect(result.partnerType).toBe('BOTH')
    })
  })
})

// ────────────────────────────────────────────
// 회계 (Accounting) Validations
// ────────────────────────────────────────────

describe('Accounting Validations', () => {
  describe('createVoucherSchema', () => {
    const validVoucher = {
      voucherDate: '2024-06-15',
      voucherType: 'RECEIPT' as const,
      details: [
        { accountSubjectId: 'acc-1', debitAmount: 10000, creditAmount: 0 },
        { accountSubjectId: 'acc-2', debitAmount: 0, creditAmount: 10000 },
      ],
    }

    it('유효한 전표 생성', () => {
      const result = createVoucherSchema.safeParse(validVoucher)
      expect(result.success).toBe(true)
    })

    it('분개 항목 비어있으면 실패', () => {
      const result = createVoucherSchema.safeParse({ ...validVoucher, details: [] })
      expect(result.success).toBe(false)
    })

    it('차변/대변 모두 0인 항목 실패', () => {
      const result = createVoucherSchema.safeParse({
        ...validVoucher,
        details: [{ accountSubjectId: 'acc-1', debitAmount: 0, creditAmount: 0 }],
      })
      expect(result.success).toBe(false)
    })

    it('차변/대변 모두 양수인 항목 실패', () => {
      const result = createVoucherSchema.safeParse({
        ...validVoucher,
        details: [{ accountSubjectId: 'acc-1', debitAmount: 100, creditAmount: 200 }],
      })
      expect(result.success).toBe(false)
    })

    it('accountCode로도 생성 가능', () => {
      const result = createVoucherSchema.safeParse({
        ...validVoucher,
        details: [
          { accountCode: 'A-101', debitAmount: 10000, creditAmount: 0 },
          { accountCode: 'A-201', debitAmount: 0, creditAmount: 10000 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('모든 voucherType enum 허용', () => {
      for (const type of ['RECEIPT', 'PAYMENT', 'TRANSFER', 'PURCHASE', 'SALES']) {
        const result = createVoucherSchema.safeParse({ ...validVoucher, voucherType: type })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('createAccountSubjectSchema', () => {
    it('유효한 계정과목 생성', () => {
      const result = createAccountSubjectSchema.safeParse({
        code: 'A-101',
        nameKo: '현금',
        accountType: 'ASSET',
      })
      expect(result.success).toBe(true)
    })

    it('계정코드 특수문자 시 실패', () => {
      const result = createAccountSubjectSchema.safeParse({
        code: 'A 101',
        nameKo: '현금',
        accountType: 'ASSET',
      })
      expect(result.success).toBe(false)
    })

    it('모든 accountType enum 허용', () => {
      for (const type of ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']) {
        const result = createAccountSubjectSchema.safeParse({
          code: 'A-101',
          nameKo: '테스트',
          accountType: type,
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('createTaxInvoiceSchema', () => {
    const validInvoice = {
      issueDate: '2024-06-15',
      invoiceType: 'SALES' as const,
      supplierBizNo: '123-45-67890',
      supplierName: '공급자',
      buyerBizNo: '987-65-43210',
      buyerName: '매입자',
      items: [
        { itemDate: '2024-06-15', itemName: '품목A', qty: 10, unitPrice: 5000, supplyAmount: 50000, taxAmount: 5000 },
      ],
    }

    it('유효한 세금계산서 생성', () => {
      const result = createTaxInvoiceSchema.safeParse(validInvoice)
      expect(result.success).toBe(true)
    })

    it('공급자 사업자번호 필수', () => {
      const result = createTaxInvoiceSchema.safeParse({ ...validInvoice, supplierBizNo: '' })
      expect(result.success).toBe(false)
    })

    it('품목 비어있으면 실패', () => {
      const result = createTaxInvoiceSchema.safeParse({ ...validInvoice, items: [] })
      expect(result.success).toBe(false)
    })
  })

  describe('createBudgetSchema', () => {
    it('유효한 예산 생성', () => {
      const result = createBudgetSchema.safeParse({
        fiscalYearId: 'fy-1',
        departmentId: 'dept-1',
        details: [{ accountSubjectId: 'acc-1', month01: 100000, month02: 200000 }],
      })
      expect(result.success).toBe(true)
    })

    it('회계연도 필수', () => {
      const result = createBudgetSchema.safeParse({
        fiscalYearId: '',
        departmentId: 'dept-1',
        details: [],
      })
      expect(result.success).toBe(false)
    })
  })
})
