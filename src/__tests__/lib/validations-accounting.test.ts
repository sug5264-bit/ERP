import { describe, it, expect } from 'vitest'
import {
  createVoucherSchema,
  createTaxInvoiceSchema,
  createAccountSubjectSchema,
  createBudgetSchema,
} from '@/lib/validations/accounting'

describe('createVoucherSchema', () => {
  const validDetail = {
    accountSubjectId: 'acc-1',
    debitAmount: 10000,
    creditAmount: 0,
  }

  const validVoucher = {
    voucherDate: '2024-06-15',
    voucherType: 'RECEIPT' as const,
    details: [validDetail],
  }

  it('유효한 전표 데이터 통과', () => {
    expect(createVoucherSchema.safeParse(validVoucher).success).toBe(true)
  })

  it('전표일자 필수 및 형식 검증', () => {
    expect(createVoucherSchema.safeParse({ ...validVoucher, voucherDate: '' }).success).toBe(false)
    expect(createVoucherSchema.safeParse({ ...validVoucher, voucherDate: '2024/06/15' }).success).toBe(false)
    expect(createVoucherSchema.safeParse({ ...validVoucher, voucherDate: 'invalid' }).success).toBe(false)
  })

  it('전표유형 enum 검증', () => {
    for (const type of ['RECEIPT', 'PAYMENT', 'TRANSFER', 'PURCHASE', 'SALES']) {
      expect(createVoucherSchema.safeParse({ ...validVoucher, voucherType: type }).success).toBe(true)
    }
    expect(createVoucherSchema.safeParse({ ...validVoucher, voucherType: 'INVALID' }).success).toBe(false)
  })

  it('분개 항목 최소 1개 필수', () => {
    expect(createVoucherSchema.safeParse({ ...validVoucher, details: [] }).success).toBe(false)
  })

  it('분개 항목: 계정과목ID 또는 코드 필수', () => {
    const noAccount = { debitAmount: 1000, creditAmount: 0 }
    expect(createVoucherSchema.safeParse({ ...validVoucher, details: [noAccount] }).success).toBe(false)

    const withCode = { accountCode: 'A100', debitAmount: 1000, creditAmount: 0 }
    expect(createVoucherSchema.safeParse({ ...validVoucher, details: [withCode] }).success).toBe(true)
  })

  it('분개 항목: 차변 또는 대변 금액 필수', () => {
    const zeroAmounts = { accountSubjectId: 'acc-1', debitAmount: 0, creditAmount: 0 }
    expect(createVoucherSchema.safeParse({ ...validVoucher, details: [zeroAmounts] }).success).toBe(false)
  })

  it('분개 항목: 차변과 대변 동시 입력 불가', () => {
    const bothAmounts = { accountSubjectId: 'acc-1', debitAmount: 1000, creditAmount: 2000 }
    expect(createVoucherSchema.safeParse({ ...validVoucher, details: [bothAmounts] }).success).toBe(false)
  })

  it('설명 선택적 (최대 1000자)', () => {
    expect(createVoucherSchema.safeParse({ ...validVoucher, description: '테스트' }).success).toBe(true)
    expect(createVoucherSchema.safeParse({ ...validVoucher, description: 'a'.repeat(1001) }).success).toBe(false)
  })
})

describe('createTaxInvoiceSchema', () => {
  const validInvoice = {
    issueDate: '2024-06-15',
    invoiceType: 'SALES' as const,
    supplierBizNo: '123-45-67890',
    supplierName: '(주)테스트',
    buyerBizNo: '987-65-43210',
    buyerName: '(주)바이어',
    items: [
      {
        itemDate: '2024-06-15',
        itemName: '테스트 품목',
        qty: 10,
        unitPrice: 1000,
        supplyAmount: 10000,
        taxAmount: 1000,
      },
    ],
  }

  it('유효한 세금계산서 데이터 통과', () => {
    expect(createTaxInvoiceSchema.safeParse(validInvoice).success).toBe(true)
  })

  it('발행일 형식 검증', () => {
    expect(createTaxInvoiceSchema.safeParse({ ...validInvoice, issueDate: '' }).success).toBe(false)
    expect(createTaxInvoiceSchema.safeParse({ ...validInvoice, issueDate: '2024/06/15' }).success).toBe(false)
  })

  it('매출/매입 유형', () => {
    expect(createTaxInvoiceSchema.safeParse({ ...validInvoice, invoiceType: 'PURCHASE' }).success).toBe(true)
    expect(createTaxInvoiceSchema.safeParse({ ...validInvoice, invoiceType: 'INVALID' }).success).toBe(false)
  })

  it('품목 최소 1개 필수', () => {
    expect(createTaxInvoiceSchema.safeParse({ ...validInvoice, items: [] }).success).toBe(false)
  })

  it('품목 수량은 1 이상', () => {
    const badItem = { ...validInvoice.items[0], qty: 0 }
    expect(createTaxInvoiceSchema.safeParse({ ...validInvoice, items: [badItem] }).success).toBe(false)
  })
})

describe('createAccountSubjectSchema', () => {
  const validSubject = {
    code: 'A100',
    nameKo: '현금',
    accountType: 'ASSET' as const,
  }

  it('유효한 계정과목 데이터 통과', () => {
    expect(createAccountSubjectSchema.safeParse(validSubject).success).toBe(true)
  })

  it('코드 영문/숫자/하이픈만', () => {
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, code: 'A-100' }).success).toBe(true)
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, code: '현금' }).success).toBe(false)
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, code: '' }).success).toBe(false)
  })

  it('계정유형 enum 검증', () => {
    for (const type of ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']) {
      expect(createAccountSubjectSchema.safeParse({ ...validSubject, accountType: type }).success).toBe(true)
    }
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, accountType: 'OTHER' }).success).toBe(false)
  })

  it('레벨 1~10 범위', () => {
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, level: 0 }).success).toBe(false)
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, level: 1 }).success).toBe(true)
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, level: 10 }).success).toBe(true)
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, level: 11 }).success).toBe(false)
  })

  it('parentId nullable', () => {
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, parentId: null }).success).toBe(true)
    expect(createAccountSubjectSchema.safeParse({ ...validSubject, parentId: 'parent-1' }).success).toBe(true)
  })
})

describe('createBudgetSchema', () => {
  const validBudget = {
    fiscalYearId: 'fy-2024',
    departmentId: 'dept-1',
    details: [
      {
        accountSubjectId: 'acc-1',
        month01: 100000,
        month02: 100000,
        month03: 100000,
        month04: 100000,
        month05: 100000,
        month06: 100000,
        month07: 100000,
        month08: 100000,
        month09: 100000,
        month10: 100000,
        month11: 100000,
        month12: 100000,
      },
    ],
  }

  it('유효한 예산 데이터 통과', () => {
    expect(createBudgetSchema.safeParse(validBudget).success).toBe(true)
  })

  it('회계연도 필수', () => {
    expect(createBudgetSchema.safeParse({ ...validBudget, fiscalYearId: '' }).success).toBe(false)
  })

  it('부서 필수', () => {
    expect(createBudgetSchema.safeParse({ ...validBudget, departmentId: '' }).success).toBe(false)
  })

  it('예산 항목 최소 1개', () => {
    expect(createBudgetSchema.safeParse({ ...validBudget, details: [] }).success).toBe(false)
  })

  it('월별 금액은 0 이상', () => {
    const badDetail = { ...validBudget.details[0], month01: -1000 }
    expect(createBudgetSchema.safeParse({ ...validBudget, details: [badDetail] }).success).toBe(false)
  })
})
