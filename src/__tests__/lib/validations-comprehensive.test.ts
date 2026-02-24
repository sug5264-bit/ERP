import { describe, it, expect } from 'vitest'
import {
  createSalesOrderSchema,
  createDeliverySchema,
  createQuotationSchema,
  createSalesReturnSchema,
  createQualityInspectionSchema,
  createQualityStandardSchema,
  createNettingSchema,
} from '@/lib/validations/sales'
import {
  createItemSchema,
  createItemCategorySchema,
  createWarehouseSchema,
  createWarehouseZoneSchema,
  createStockMovementSchema,
  createPartnerSchema,
} from '@/lib/validations/inventory'
import {
  createVoucherSchema,
  createTaxInvoiceSchema,
  createAccountSubjectSchema,
  createBudgetSchema,
} from '@/lib/validations/accounting'
import {
  createEmployeeSchema,
  createDepartmentSchema,
  createPositionSchema,
  createAttendanceSchema,
  createLeaveSchema,
} from '@/lib/validations/hr'
import { createApprovalDocumentSchema } from '@/lib/validations/approval'
import { createPostSchema, createCommentSchema, createMessageSchema } from '@/lib/validations/board'
import { createProjectSchema, createProjectTaskSchema, createPayrollSchema } from '@/lib/validations/project'

describe('프론트엔드 폼 전송 시뮬레이션', () => {
  describe('입출고 (Stock Movement)', () => {
    it('입고', () => {
      expect(createStockMovementSchema.safeParse({
        movementDate: '2026-02-24', movementType: 'INBOUND', targetWarehouseId: 'wh-1',
        details: [{ itemId: 'i1', quantity: 100, unitPrice: 15000 }],
      }).success).toBe(true)
    })
    it('출고', () => {
      expect(createStockMovementSchema.safeParse({
        movementDate: '2026-02-24', movementType: 'OUTBOUND', sourceWarehouseId: 'wh-1',
        details: [{ itemId: 'i1', quantity: 10, unitPrice: 15000 }],
      }).success).toBe(true)
    })
    it('이체', () => {
      expect(createStockMovementSchema.safeParse({
        movementDate: '2026-02-24', movementType: 'TRANSFER',
        sourceWarehouseId: 'wh-1', targetWarehouseId: 'wh-2',
        details: [{ itemId: 'i1', quantity: 30 }],
      }).success).toBe(true)
    })
    it('재고조정', () => {
      expect(createStockMovementSchema.safeParse({
        movementDate: '2026-02-24', movementType: 'ADJUSTMENT', targetWarehouseId: 'wh-1',
        details: [{ itemId: 'i1', quantity: 200 }],
      }).success).toBe(true)
    })
  })

  describe('수주 (Sales Order)', () => {
    it('오프라인 수주', () => {
      expect(createSalesOrderSchema.safeParse({
        orderDate: '2026-02-24', partnerId: 'p1', salesChannel: 'OFFLINE', vatIncluded: true,
        details: [{ itemId: 'i1', quantity: 20, unitPrice: 150000 }],
      }).success).toBe(true)
    })
    it('온라인 수주 이커머스 필드', () => {
      expect(createSalesOrderSchema.safeParse({
        orderDate: '2026-02-24', salesChannel: 'ONLINE', vatIncluded: true,
        siteName: '쿠팡', ordererName: '홍길동', recipientName: '김철수',
        recipientAddress: '서울시', shippingCost: 3000,
        details: [{ itemId: 'i1', quantity: 1, unitPrice: 150000 }],
      }).success).toBe(true)
    })
    it('partnerId null 허용', () => {
      expect(createSalesOrderSchema.safeParse({
        orderDate: '2026-02-24', partnerId: null,
        details: [{ itemId: 'i1', quantity: 1, unitPrice: 100 }],
      }).success).toBe(true)
    })
    it('deliveryDate 빈 문자열 허용', () => {
      expect(createSalesOrderSchema.safeParse({
        orderDate: '2026-02-24', deliveryDate: '',
        details: [{ itemId: 'i1', quantity: 1, unitPrice: 100 }],
      }).success).toBe(true)
    })
  })

  describe('견적 (Quotation)', () => {
    it('기본 견적', () => {
      expect(createQuotationSchema.safeParse({
        quotationDate: '2026-02-24', partnerId: 'p1',
        details: [{ itemId: 'i1', quantity: 100, unitPrice: 10000 }],
      }).success).toBe(true)
    })
    it('validUntil undefined 허용', () => {
      expect(createQuotationSchema.safeParse({
        quotationDate: '2026-02-24', partnerId: 'p1', validUntil: undefined,
        details: [{ itemId: 'i1', quantity: 100, unitPrice: 10000 }],
      }).success).toBe(true)
    })
  })

  describe('납품 (Delivery) - trackingNo/carrier 신규 필드', () => {
    it('기본 납품', () => {
      expect(createDeliverySchema.safeParse({
        deliveryDate: '2026-02-24', salesOrderId: 'so1',
        details: [{ itemId: 'i1', quantity: 5, unitPrice: 150000 }],
      }).success).toBe(true)
    })
    it('trackingNo/carrier 포함', () => {
      const r = createDeliverySchema.safeParse({
        deliveryDate: '2026-02-24', salesOrderId: 'so1',
        trackingNo: 'CJ123', carrier: 'CJ대한통운',
        details: [{ itemId: 'i1', quantity: 5, unitPrice: 150000 }],
      })
      expect(r.success).toBe(true)
      if (r.success) {
        expect(r.data.trackingNo).toBe('CJ123')
        expect(r.data.carrier).toBe('CJ대한통운')
      }
    })
    it('trackingNo/carrier undefined 허용', () => {
      expect(createDeliverySchema.safeParse({
        deliveryDate: '2026-02-24', salesOrderId: 'so1',
        trackingNo: undefined, carrier: undefined,
        details: [{ itemId: 'i1', quantity: 5, unitPrice: 150000 }],
      }).success).toBe(true)
    })
  })

  describe('반품 (Sales Return)', () => {
    it('details 없이 전송 (기본값 [])', () => {
      const r = createSalesReturnSchema.safeParse({
        returnDate: '2026-02-24', salesOrderId: 'so1', partnerId: 'p1',
        reason: 'DEFECT', totalAmount: 150000,
      })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.details).toEqual([])
    })
    it('모든 reason enum 허용', () => {
      for (const reason of ['DEFECT', 'WRONG_ITEM', 'CUSTOMER_CHANGE', 'QUALITY_ISSUE', 'OTHER']) {
        expect(createSalesReturnSchema.safeParse({
          returnDate: '2026-02-24', salesOrderId: 'so1', partnerId: 'p1', reason,
        }).success).toBe(true)
      }
    })
  })

  describe('전표 (Voucher)', () => {
    it('매출 전표', () => {
      expect(createVoucherSchema.safeParse({
        voucherDate: '2026-02-24', voucherType: 'SALES',
        details: [
          { accountSubjectId: 'a1', debitAmount: 1000000, creditAmount: 0 },
          { accountSubjectId: 'a2', debitAmount: 0, creditAmount: 1000000 },
        ],
      }).success).toBe(true)
    })
  })

  describe('사원 (Employee)', () => {
    it('필수 필드만', () => {
      expect(createEmployeeSchema.safeParse({
        employeeNo: 'EMP-011', nameKo: '테스트', departmentId: 'd1',
        positionId: 'p1', joinDate: '2026-02-24', employeeType: 'REGULAR',
      }).success).toBe(true)
    })
    it('email 빈 문자열 허용', () => {
      expect(createEmployeeSchema.safeParse({
        employeeNo: 'EMP-012', nameKo: '테스트', departmentId: 'd1',
        positionId: 'p1', joinDate: '2026-02-24', employeeType: 'REGULAR', email: '',
      }).success).toBe(true)
    })
    it('사번 한글 불가', () => {
      expect(createEmployeeSchema.safeParse({
        employeeNo: 'EMP-한글', nameKo: '테스트', departmentId: 'd1',
        positionId: 'p1', joinDate: '2026-02-24', employeeType: 'REGULAR',
      }).success).toBe(false)
    })
  })

  describe('근태 (Attendance)', () => {
    it('정상 출근', () => {
      expect(createAttendanceSchema.safeParse({
        employeeId: 'e1', workDate: '2026-02-24', attendanceType: 'NORMAL',
        checkInTime: '2026-02-24T09:00', checkOutTime: '2026-02-24T18:00',
      }).success).toBe(true)
    })
    it('모든 enum 허용', () => {
      for (const t of ['NORMAL', 'LATE', 'EARLY', 'ABSENT', 'BUSINESS', 'REMOTE']) {
        expect(createAttendanceSchema.safeParse({
          employeeId: 'e1', workDate: '2026-02-24', attendanceType: t,
        }).success).toBe(true)
      }
    })
  })

  describe('휴가 (Leave)', () => {
    it('연차', () => {
      expect(createLeaveSchema.safeParse({
        employeeId: 'e1', leaveType: 'ANNUAL',
        startDate: '2026-03-01', endDate: '2026-03-03', days: 3,
      }).success).toBe(true)
    })
    it('반차 0.5일 허용', () => {
      expect(createLeaveSchema.safeParse({
        employeeId: 'e1', leaveType: 'ANNUAL',
        startDate: '2026-03-01', endDate: '2026-03-01', days: 0.5,
      }).success).toBe(true)
    })
    it('일수 0 실패', () => {
      expect(createLeaveSchema.safeParse({
        employeeId: 'e1', leaveType: 'ANNUAL',
        startDate: '2026-03-01', endDate: '2026-03-01', days: 0,
      }).success).toBe(false)
    })
  })

  describe('결재 (Approval)', () => {
    it('기본 결재문서', () => {
      expect(createApprovalDocumentSchema.safeParse({
        title: '출장', draftDate: '2026-02-24', urgency: 'NORMAL',
        steps: [{ approverId: 'e1', approvalType: 'APPROVE' }],
      }).success).toBe(true)
    })
    it('결재자 없으면 실패', () => {
      expect(createApprovalDocumentSchema.safeParse({
        title: '출장', draftDate: '2026-02-24', steps: [],
      }).success).toBe(false)
    })
  })

  describe('게시판 (Board)', () => {
    it('게시글', () => {
      expect(createPostSchema.safeParse({ boardId: 'b1', title: '제목', content: '내용' }).success).toBe(true)
    })
    it('댓글', () => {
      expect(createCommentSchema.safeParse({ postId: 'p1', content: '댓글' }).success).toBe(true)
    })
    it('메시지', () => {
      expect(createMessageSchema.safeParse({ receiverId: 'u1', subject: '제목', content: '내용' }).success).toBe(true)
    })
  })

  describe('프로젝트/급여', () => {
    it('프로젝트', () => {
      expect(createProjectSchema.safeParse({
        projectCode: 'PRJ-001', projectName: '리뉴얼', managerId: 'e1',
        departmentId: 'd1', startDate: '2026-03-01',
      }).success).toBe(true)
    })
    it('급여', () => {
      expect(createPayrollSchema.safeParse({ payPeriod: '2026-02', payDate: '2026-02-25' }).success).toBe(true)
    })
  })

  describe('기타', () => {
    it('품목분류', () => {
      expect(createItemCategorySchema.safeParse({ code: 'CAT-05', name: '기타' }).success).toBe(true)
    })
    it('창고구역', () => {
      expect(createWarehouseZoneSchema.safeParse({ warehouseId: 'w1', zoneCode: 'D', zoneName: 'D구역' }).success).toBe(true)
    })
    it('부서', () => {
      expect(createDepartmentSchema.safeParse({ code: 'HR', name: '인사팀' }).success).toBe(true)
    })
    it('직급', () => {
      expect(createPositionSchema.safeParse({ code: 'ASST', name: '주임', level: 6 }).success).toBe(true)
    })
    it('품질기준', () => {
      expect(createQualityStandardSchema.safeParse({
        itemId: 'i1', standardName: '외관기준', category: '외관검사',
      }).success).toBe(true)
    })
    it('상계 coerce', () => {
      const r = createNettingSchema.safeParse({ partnerId: 'p1', amount: '500000', nettingDate: '2026-02-24' })
      expect(r.success).toBe(true)
      if (r.success) expect(r.data.amount).toBe(500000)
    })
    it('거래처 전체필드', () => {
      expect(createPartnerSchema.safeParse({
        partnerCode: 'P-099', partnerName: '(주)테스트', partnerType: 'BOTH',
        bizNo: '111-22-33333', email: 'a@b.com',
      }).success).toBe(true)
    })
    it('세금계산서', () => {
      expect(createTaxInvoiceSchema.safeParse({
        issueDate: '2026-02-24', invoiceType: 'SALES',
        supplierBizNo: '123-45-67890', supplierName: '공급자',
        buyerBizNo: '987-65-43210', buyerName: '매입자',
        items: [{ itemDate: '2026-02-24', itemName: '품목A', qty: 10, unitPrice: 5000, supplyAmount: 50000, taxAmount: 5000 }],
      }).success).toBe(true)
    })
    it('예산 월별 기본값', () => {
      const r = createBudgetSchema.parse({
        fiscalYearId: 'fy1', departmentId: 'd1',
        details: [{ accountSubjectId: 'a1', month01: 3000000 }],
      })
      expect(r.details[0].month03).toBe(0)
    })
  })
})
