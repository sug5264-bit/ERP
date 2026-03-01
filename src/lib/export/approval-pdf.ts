import { createPDFDocument, addPageNumbers, getLastTableY, PDF_COLORS, fmtPrintDate } from './pdf-base'
import { sanitizeFileName } from '@/lib/sanitize'

interface ApprovalDocExport {
  documentNo: string
  title: string
  draftDate: string
  urgency: string
  status: string
  content:
    | {
        body?: string
        amount?: string
        period?: string
        destination?: string
        purpose?: string
        [key: string]: unknown
      }
    | string
    | null
  drafter: {
    nameKo: string
    department?: { name: string } | null
    position?: { name: string } | null
  }
  steps: {
    stepOrder: number
    approver: {
      nameKo: string
      position?: { name: string } | null
      department?: { name: string } | null
    }
    status: string
    comment?: string | null
    actionDate?: string | null
  }[]
}

const STATUS_MAP: Record<string, string> = {
  DRAFTED: '임시저장',
  IN_PROGRESS: '진행중',
  APPROVED: '승인완료',
  REJECTED: '반려',
  CANCELLED: '취소',
  PENDING: '대기',
}

const URGENCY_MAP: Record<string, string> = {
  NORMAL: '일반',
  URGENT: '긴급',
  EMERGENCY: '초긴급',
}

export async function exportApprovalPdf(doc: ApprovalDocExport) {
  const { doc: pdf, autoTable, fontName, pageWidth } = await createPDFDocument()

  // 제목 영역
  pdf.setFontSize(20)
  pdf.text('결 재 문 서', pageWidth / 2, 20, { align: 'center' })

  pdf.setFontSize(10)
  pdf.text(`문서번호: ${doc.documentNo}`, pageWidth / 2, 28, { align: 'center' })

  // 구분선
  pdf.setLineWidth(0.5)
  pdf.line(15, 33, pageWidth - 15, 33)

  // 문서 정보
  let y = 40

  autoTable({
    startY: y,
    body: [
      ['제목', doc.title],
      [
        '기안자',
        `${doc.drafter.nameKo} / ${doc.drafter.department?.name || '-'} / ${doc.drafter.position?.name || '-'}`,
      ],
      ['기안일', doc.draftDate],
      ['긴급도', URGENCY_MAP[doc.urgency] || doc.urgency],
      ['상태', STATUS_MAP[doc.status] || doc.status],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' as unknown as number },
    },
    margin: { left: 15, right: 15 },
  })

  y = getLastTableY(pdf) + 10

  // 결재선
  pdf.setFontSize(11)
  pdf.text('결재선', 15, y)
  y += 3

  autoTable({
    startY: y,
    head: [['순번', '결재자', '직급', '부서', '상태', '의견', '처리일']],
    body: doc.steps.map((s) => [
      String(s.stepOrder),
      s.approver.nameKo,
      s.approver.position?.name || '-',
      s.approver.department?.name || '-',
      STATUS_MAP[s.status] || s.status,
      s.comment || '-',
      s.actionDate ? new Date(s.actionDate).toLocaleDateString('ko-KR') : '-',
    ]),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: PDF_COLORS.HEADER_FILL, textColor: 255, halign: 'center' },
    margin: { left: 15, right: 15 },
  })

  y = getLastTableY(pdf) + 10

  // 본문
  const content = typeof doc.content === 'object' && doc.content !== null ? doc.content : null
  if (content?.body) {
    pdf.setFontSize(11)
    pdf.text('내용', 15, y)
    y += 5

    pdf.setFontSize(10)
    const lines = pdf.splitTextToSize(content.body, pageWidth - 30)
    pdf.text(lines, 15, y)
    y += lines.length * 5
  }

  // 추가 정보 (금액, 기간 등)
  if (content?.amount || content?.period || content?.destination) {
    y += 5
    pdf.setFontSize(11)
    pdf.text('상세 정보', 15, y)
    y += 3

    const detailData: string[][] = []
    if (content.amount) detailData.push(['금액', content.amount])
    if (content.period) detailData.push(['기간', content.period])
    if (content.destination) detailData.push(['목적지', content.destination])
    if (content.purpose) detailData.push(['목적', content.purpose])

    if (detailData.length > 0) {
      autoTable({
        startY: y,
        body: detailData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
        margin: { left: 15, right: 15 },
      })
    }
  }

  // 푸터 (페이지 번호 + 출력일)
  addPageNumbers(pdf, fontName, { prefix: `출력일: ${fmtPrintDate()}`, bottomOffset: 10 })

  // 다운로드
  pdf.save(sanitizeFileName(`${doc.documentNo}_${doc.title}`) + '.pdf')
}
