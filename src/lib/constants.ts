export const APP_NAME = '웰그린 ERP'
export const COMPANY_NAME = '(주)웰그린'

// SAP 모듈 기준 라벨 (식품 유통사 맞춤)
export const MODULE_LABELS: Record<string, string> = {
  dashboard: '대시보드',
  sales: '영업관리', // SAP SD
  purchasing: '구매관리', // SAP MM
  production: '생산관리', // SAP PP
  inventory: '재고관리', // SAP WM
  quality: '품질관리', // SAP QM
  accounting: '회계관리', // SAP FI
  hr: '인사관리', // SAP HR
  closing: '정산관리',
  approval: '전자결재',
  board: '게시판',
  admin: '시스템관리',
  shipper: '3PL 물류',
}

export const ACTION_LABELS: Record<string, string> = {
  read: '조회',
  create: '등록',
  update: '수정',
  delete: '삭제',
  export: '내보내기',
  import: '가져오기',
  approve: '승인',
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: '등록',
  UPDATE: '수정',
  DELETE: '삭제',
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
  EXPORT: '내보내기',
  IMPORT: '가져오기',
  APPROVE: '승인',
  REJECT: '반려',
}

// 식품 유통사 공통 코드
export const ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  CONFIRMED: '확정',
  IN_PROGRESS: '진행중',
  SHIPPED: '출하완료',
  DELIVERED: '배송완료',
  CLOSED: '마감',
  CANCELLED: '취소',
}

export const ITEM_TYPE_LABELS: Record<string, string> = {
  FINISHED: '완제품',
  RAW_MATERIAL: '원자재',
  PACKAGING: '포장재',
  SUB_MATERIAL: '부자재',
}

export const STORAGE_TYPE_LABELS: Record<string, string> = {
  AMBIENT: '상온',
  REFRIGERATED: '냉장',
  FROZEN: '냉동',
}

// 출하 상태
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PREPARING: '준비중',
  SHIPPED: '출하완료',
  IN_TRANSIT: '배송중',
  DELIVERED: '배송완료',
  RETURNED: '반품',
}

// 화주사 주문 상태
export const SHIPPER_ORDER_STATUS_LABELS: Record<string, string> = {
  RECEIVED: '접수',
  PROCESSING: '처리중',
  SHIPPED: '출고',
  IN_TRANSIT: '배송중',
  DELIVERED: '배송완료',
  RETURNED: '반품',
}

// 배송 방법
export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  NORMAL: '일반배송',
  EXPRESS: '빠른배송',
  SAME_DAY: '당일배송',
}

// 생산 상태
export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
  PLANNED: '계획',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  CANCELLED: '취소',
}

// OEM 계약 상태
export const OEM_CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  ACTIVE: '유효',
  SUSPENDED: '중지',
  TERMINATED: '종료',
}

// 품질검사 등급
export const QUALITY_GRADE_LABELS: Record<string, string> = {
  A: 'A등급',
  B: 'B등급',
  C: 'C등급',
  REJECT: '불합격',
}

// 검사 판정
export const INSPECTION_JUDGEMENT_LABELS: Record<string, string> = {
  PASS: '합격',
  CONDITIONAL: '조건부합격',
  FAIL: '불합격',
}

// 계정 유형 (자사 vs 화주사)
export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  INTERNAL: '자사',
  SHIPPER: '화주사',
}
