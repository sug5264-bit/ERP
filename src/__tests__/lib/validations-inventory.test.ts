import { describe, it, expect } from 'vitest'
import {
  createItemCategorySchema,
  createItemSchema,
  updateItemSchema,
  createWarehouseSchema,
  createWarehouseZoneSchema,
  createStockMovementSchema,
  createPartnerSchema,
  updatePartnerSchema,
} from '@/lib/validations/inventory'

describe('createItemCategorySchema', () => {
  it('유효한 분류 데이터 통과', () => {
    expect(createItemCategorySchema.safeParse({ code: 'CAT-01', name: '원자재' }).success).toBe(true)
  })

  it('코드 영문/숫자/하이픈만', () => {
    expect(createItemCategorySchema.safeParse({ code: '한글', name: '분류' }).success).toBe(false)
    expect(createItemCategorySchema.safeParse({ code: '', name: '분류' }).success).toBe(false)
  })

  it('parentId nullable', () => {
    expect(createItemCategorySchema.safeParse({ code: 'C1', name: '분류', parentId: null }).success).toBe(true)
    expect(createItemCategorySchema.safeParse({ code: 'C1', name: '분류', parentId: 'p-1' }).success).toBe(true)
  })
})

describe('createItemSchema', () => {
  const validItem = {
    itemCode: 'ITEM-001',
    itemName: '테스트 품목',
  }

  it('유효한 품목 데이터 통과', () => {
    expect(createItemSchema.safeParse(validItem).success).toBe(true)
  })

  it('품목코드 필수 및 패턴 검증', () => {
    expect(createItemSchema.safeParse({ ...validItem, itemCode: '' }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...validItem, itemCode: '한글코드' }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...validItem, itemCode: 'A'.repeat(31) }).success).toBe(false)
  })

  it('품목유형 enum 검증', () => {
    for (const type of ['RAW_MATERIAL', 'PRODUCT', 'GOODS', 'SUBSIDIARY']) {
      expect(createItemSchema.safeParse({ ...validItem, itemType: type }).success).toBe(true)
    }
    expect(createItemSchema.safeParse({ ...validItem, itemType: 'INVALID' }).success).toBe(false)
  })

  it('세금유형 enum 검증', () => {
    for (const type of ['TAXABLE', 'TAX_FREE', 'ZERO_RATE']) {
      expect(createItemSchema.safeParse({ ...validItem, taxType: type }).success).toBe(true)
    }
  })

  it('기준가격 범위', () => {
    expect(createItemSchema.safeParse({ ...validItem, standardPrice: 0 }).success).toBe(true)
    expect(createItemSchema.safeParse({ ...validItem, standardPrice: -1 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...validItem, standardPrice: 999_999_999_999 }).success).toBe(true)
    expect(createItemSchema.safeParse({ ...validItem, standardPrice: 1_000_000_000_000 }).success).toBe(false)
  })

  it('안전재고 정수 및 범위', () => {
    expect(createItemSchema.safeParse({ ...validItem, safetyStock: 0 }).success).toBe(true)
    expect(createItemSchema.safeParse({ ...validItem, safetyStock: 1.5 }).success).toBe(false)
    expect(createItemSchema.safeParse({ ...validItem, safetyStock: -1 }).success).toBe(false)
  })

  it('식품 전용 필드 선택적', () => {
    expect(
      createItemSchema.safeParse({
        ...validItem,
        manufacturer: '제조사',
        originCountry: '한국',
        storageTemp: '냉장 (2~8°C)',
        shelfLifeDays: 30,
        allergens: '대두, 밀',
      }).success
    ).toBe(true)
  })

  it('유통기한 일수 범위', () => {
    expect(createItemSchema.safeParse({ ...validItem, shelfLifeDays: 0 }).success).toBe(true)
    expect(createItemSchema.safeParse({ ...validItem, shelfLifeDays: 9999 }).success).toBe(true)
    expect(createItemSchema.safeParse({ ...validItem, shelfLifeDays: 10000 }).success).toBe(false)
  })
})

describe('updateItemSchema', () => {
  it('부분 업데이트 허용', () => {
    expect(updateItemSchema.safeParse({ itemName: '수정된 품목' }).success).toBe(true)
    expect(updateItemSchema.safeParse({}).success).toBe(true)
  })
})

describe('createWarehouseSchema', () => {
  it('유효한 창고 데이터 통과', () => {
    expect(createWarehouseSchema.safeParse({ code: 'WH-01', name: '본사 창고' }).success).toBe(true)
  })

  it('코드 필수', () => {
    expect(createWarehouseSchema.safeParse({ code: '', name: '창고' }).success).toBe(false)
  })
})

describe('createStockMovementSchema', () => {
  const validMovement = {
    movementDate: '2024-06-15',
    movementType: 'INBOUND' as const,
    details: [{ itemId: 'item-1', quantity: 10 }],
  }

  it('유효한 입출고 데이터 통과', () => {
    expect(createStockMovementSchema.safeParse(validMovement).success).toBe(true)
  })

  it('이동유형 enum 검증', () => {
    for (const type of ['INBOUND', 'OUTBOUND', 'TRANSFER', 'ADJUSTMENT']) {
      expect(createStockMovementSchema.safeParse({ ...validMovement, movementType: type }).success).toBe(true)
    }
    expect(createStockMovementSchema.safeParse({ ...validMovement, movementType: 'INVALID' }).success).toBe(false)
  })

  it('품목 최소 1개 필수', () => {
    expect(createStockMovementSchema.safeParse({ ...validMovement, details: [] }).success).toBe(false)
  })

  it('수량은 0보다 커야 함', () => {
    const badDetail = { itemId: 'item-1', quantity: 0 }
    expect(createStockMovementSchema.safeParse({ ...validMovement, details: [badDetail] }).success).toBe(false)
  })

  it('로트번호/유통기한 선택적', () => {
    const withLot = { itemId: 'item-1', quantity: 5, lotNo: 'LOT-001', expiryDate: '2025-12-31' }
    expect(createStockMovementSchema.safeParse({ ...validMovement, details: [withLot] }).success).toBe(true)
  })
})

describe('createPartnerSchema', () => {
  const validPartner = {
    partnerCode: 'PTN-001',
    partnerName: '(주)테스트',
  }

  it('유효한 거래처 데이터 통과', () => {
    expect(createPartnerSchema.safeParse(validPartner).success).toBe(true)
  })

  it('거래처코드 패턴 검증', () => {
    expect(createPartnerSchema.safeParse({ ...validPartner, partnerCode: '한글' }).success).toBe(false)
  })

  it('거래처유형 enum', () => {
    for (const type of ['SALES', 'PURCHASE', 'BOTH']) {
      expect(createPartnerSchema.safeParse({ ...validPartner, partnerType: type }).success).toBe(true)
    }
  })

  it('사업자번호 형식 검증', () => {
    expect(createPartnerSchema.safeParse({ ...validPartner, bizNo: '123-45-67890' }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, bizNo: '1234567890' }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, bizNo: '' }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, bizNo: null }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, bizNo: '12345' }).success).toBe(false)
  })

  it('이메일 형식 검증', () => {
    expect(createPartnerSchema.safeParse({ ...validPartner, email: 'test@co.kr' }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, email: '' }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, email: 'not-email' }).success).toBe(false)
  })

  it('신용한도 범위', () => {
    expect(createPartnerSchema.safeParse({ ...validPartner, creditLimit: 0 }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, creditLimit: -1 }).success).toBe(false)
    expect(createPartnerSchema.safeParse({ ...validPartner, creditLimit: 1_000_000_000_000 }).success).toBe(false)
  })

  it('판매채널 enum', () => {
    expect(createPartnerSchema.safeParse({ ...validPartner, salesChannel: 'ONLINE' }).success).toBe(true)
    expect(createPartnerSchema.safeParse({ ...validPartner, salesChannel: 'OFFLINE' }).success).toBe(true)
  })

  it('식품제조사 전용 필드', () => {
    expect(
      createPartnerSchema.safeParse({
        ...validPartner,
        foodBizNo: 'FB-001',
        haccpNo: 'HACCP-001',
        factoryAddress: '경기도 화성시',
      }).success
    ).toBe(true)
  })
})

describe('updatePartnerSchema', () => {
  it('부분 업데이트 허용', () => {
    expect(updatePartnerSchema.safeParse({ partnerName: '수정' }).success).toBe(true)
    expect(updatePartnerSchema.safeParse({}).success).toBe(true)
  })
})
