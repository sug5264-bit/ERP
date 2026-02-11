export const APP_NAME = '웰그린 ERP'
export const COMPANY_NAME = '웰그린 주식회사'

export const ITEMS_PER_PAGE = 20

export const MODULE_LABELS: Record<string, string> = {
  dashboard: '대시보드',
  accounting: '회계',
  hr: '인사',
  inventory: '재고',
  sales: '판매',
  approval: '전자결재',
  board: '게시판',
  admin: '시스템관리',
}

export const STATUS_LABELS: Record<string, string> = {
  // 공통
  DRAFT: '작성',
  APPROVED: '승인',
  CONFIRMED: '확정',
  CANCELLED: '취소',
  COMPLETED: '완료',
  PENDING: '대기',
  REJECTED: '반려',

  // 사원 상태
  ACTIVE: '재직',
  ON_LEAVE: '휴직',
  RESIGNED: '퇴직',

  // 사원 유형
  REGULAR: '정규직',
  CONTRACT: '계약직',
  DISPATCH: '파견',
  INTERN: '인턴',

  // 근태
  NORMAL: '정상',
  LATE: '지각',
  EARLY: '조퇴',
  ABSENT: '결근',
  BUSINESS: '출장',
  REMOTE: '재택',

  // 휴가
  ANNUAL: '연차',
  SICK: '병가',
  FAMILY: '경조',
  MATERNITY: '출산',
  PARENTAL: '육아',
  OFFICIAL: '공가',
  REQUESTED: '신청',

  // 전표
  RECEIPT: '입금',
  PAYMENT: '출금',
  TRANSFER: '대체',
  PURCHASE: '매입',
  SALES: '매출',

  // 계정유형
  ASSET: '자산',
  LIABILITY: '부채',
  EQUITY: '자본',
  REVENUE: '수익',
  EXPENSE: '비용',

  // 견적
  SUBMITTED: '제출',
  ORDERED: '발주',
  LOST: '실주',

  // 발주
  IN_PROGRESS: '진행',

  // 납품
  PREPARING: '준비',
  SHIPPING: '배송중',

  // 구매
  RECEIVING: '입고중',

  // 입고
  RECEIVED: '입고',
  INSPECTED: '검수',

  // 프로젝트
  PLANNING: '계획',
  ON_HOLD: '보류',

  // 전자결재
  DRAFTED: '기안',
  SKIPPED: '건너뜀',

  // 품목 유형
  RAW_MATERIAL: '원자재',
  PRODUCT: '제품',
  GOODS: '상품',
  SUBSIDIARY: '부자재',

  // 재고이동
  INBOUND: '입고',
  OUTBOUND: '출고',
  ADJUSTMENT: '조정',

  // 거래처
  BOTH: '겸용',

  // 채용
  OPEN: '진행중',
  CLOSED: '마감',
  APPLIED: '지원',
  SCREENING: '서류심사',
  INTERVIEW: '면접',
  ACCEPTED: '합격',

  // 급여
  PAID: '지급완료',

  // 우선순위
  URGENT: '긴급',
  HIGH: '높음',
  LOW: '낮음',

  // 업무
  WAITING: '대기',

  // 프로젝트 멤버
  PM: 'PM',
  MEMBER: '팀원',
  REVIEWER: '검토자',

  // 결재
  APPROVE: '결재',
  AGREE: '합의',
  REFERENCE: '참조',
  DESIGNATED: '지정',
  DEPT_HEAD: '부서장',
  POSITION: '직급',
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'secondary',
  APPROVED: 'default',
  CONFIRMED: 'default',
  COMPLETED: 'default',
  CANCELLED: 'destructive',
  REJECTED: 'destructive',
  PENDING: 'secondary',
  ACTIVE: 'default',
  ON_LEAVE: 'secondary',
  RESIGNED: 'destructive',
  IN_PROGRESS: 'default',
  PLANNING: 'secondary',
  ON_HOLD: 'secondary',
  DRAFTED: 'secondary',
  REQUESTED: 'secondary',
  ORDERED: 'default',
  PREPARING: 'secondary',
  SHIPPING: 'default',
  RECEIVED: 'default',
  OPEN: 'default',
  CLOSED: 'destructive',
  URGENT: 'destructive',
  HIGH: 'destructive',
  NORMAL: 'secondary',
  LOW: 'secondary',
}
