/**
 * PDF 생성 공통 기반 모듈
 * - createPDFDocument: jsPDF + autoTable 동적 임포트, 문서 생성, 한글 폰트 로딩
 * - addPageNumbers: 전체 페이지에 페이지 번호 추가
 * - getLastTableY: autoTable 이후 Y 좌표 안전 추출
 * - 공통 색상 팔레트
 */

import type jsPDF from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'
import { loadKoreanFont } from '@/lib/pdf-font'

// ---------------------------------------------------------------------------
// 공통 색상 팔레트
// ---------------------------------------------------------------------------
export const PDF_COLORS = {
  HEADER_FILL: [68, 114, 196] as [number, number, number],
  HEADER_TEXT: [255, 255, 255] as [number, number, number],
  LIGHT_GRAY: [240, 240, 240] as [number, number, number],
  ALT_ROW: [245, 247, 250] as [number, number, number],
}

export const PAGE_MARGIN = 14

// ---------------------------------------------------------------------------
// PDF 문서 생성
// ---------------------------------------------------------------------------
export interface CreatePDFOptions {
  orientation?: 'portrait' | 'landscape'
  unit?: 'mm' | 'pt' | 'px'
  format?: string
}

export interface PDFDocument {
  doc: InstanceType<typeof jsPDF>
  autoTable: (options: UserOptions) => void
  fontName: string
  pageWidth: number
  pageHeight: number
}

/**
 * jsPDF 문서를 생성하고 한글 폰트를 로드한 후 autoTable 헬퍼와 함께 반환
 */
export async function createPDFDocument(options: CreatePDFOptions = {}): Promise<PDFDocument> {
  const [{ default: jsPDFClass }, { default: autoTableFn }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const doc = new jsPDFClass({
    orientation: options.orientation ?? 'portrait',
    unit: options.unit ?? 'mm',
    format: options.format ?? 'a4',
    putOnlyUsedFonts: true,
  })

  const fontName = await loadKoreanFont(doc)

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const autoTable = (opts: UserOptions) => {
    autoTableFn(doc, {
      ...opts,
      styles: { font: fontName, ...opts.styles },
      headStyles: { font: fontName, ...opts.headStyles },
    })
  }

  return { doc, autoTable, fontName, pageWidth, pageHeight }
}

// ---------------------------------------------------------------------------
// autoTable 이후 Y 좌표 추출
// ---------------------------------------------------------------------------

/** autoTable 렌더링 후 최종 Y 좌표를 안전하게 추출 */
export function getLastTableY(doc: InstanceType<typeof jsPDF>): number {
  return (doc as any).lastAutoTable?.finalY ?? 0
}

// ---------------------------------------------------------------------------
// 페이지 번호 추가
// ---------------------------------------------------------------------------

export interface PageNumberOptions {
  /** 추가 푸터 텍스트 (예: 출력일 표시) */
  prefix?: string
  /** 페이지 하단에서의 거리 (mm) */
  bottomOffset?: number
}

/** 모든 페이지에 페이지 번호를 추가 */
export function addPageNumbers(doc: InstanceType<typeof jsPDF>, fontName: string, options: PageNumberOptions = {}) {
  const { prefix, bottomOffset = 8 } = options
  const pageCount = doc.getNumberOfPages()
  const centerX = doc.internal.pageSize.getWidth() / 2
  const y = doc.internal.pageSize.getHeight() - bottomOffset

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    if (fontName !== 'helvetica') doc.setFont(fontName)
    const text = prefix ? `${prefix} | ${i} / ${pageCount}` : `${i} / ${pageCount}`
    doc.text(text, centerX, y, { align: 'center' })
  }
}

// ---------------------------------------------------------------------------
// 공통 autoTable 스타일 프리셋
// ---------------------------------------------------------------------------

/** 표준 헤더 스타일 */
export const defaultHeadStyles = {
  fillColor: PDF_COLORS.HEADER_FILL,
  textColor: PDF_COLORS.HEADER_TEXT,
  halign: 'center' as const,
  fontStyle: 'bold' as const,
}

/** 라벨 컬럼 스타일 (정보 테이블의 왼쪽 라벨) */
export const labelColumnStyle = {
  fillColor: PDF_COLORS.LIGHT_GRAY,
  fontStyle: 'bold' as const,
  halign: 'center' as const,
}

// ---------------------------------------------------------------------------
// 숫자 포맷
// ---------------------------------------------------------------------------
export const fmtNumber = (n: number | null | undefined) => {
  if (n == null || isNaN(n)) return '0'
  return n.toLocaleString('ko-KR')
}

// ---------------------------------------------------------------------------
// 날짜 포맷 (출력일용)
// ---------------------------------------------------------------------------
export function fmtPrintDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
