export const APP_NAME = '웰그린 ERP'
export const COMPANY_NAME = '웰그린 주식회사'

export const MODULE_LABELS: Record<string, string> = {
  dashboard: '대시보드',
  accounting: '회계',
  hr: '인사',
  inventory: '재고',
  sales: '매출',
  projects: '프로젝트',
  approval: '전자결재',
  board: '게시판',
  admin: '시스템관리',
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
