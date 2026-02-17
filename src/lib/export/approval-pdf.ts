import jsPDF from 'jspdf'
import 'jspdf-autotable'

interface ApprovalDocExport {
  documentNo: string
  title: string
  draftDate: string
  urgency: string
  status: string
  content: any
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

export function exportApprovalPdf(doc: ApprovalDocExport) {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()

  // 폰트 설정 (기본 폰트 - 한글 지원을 위해 간결하게 처리)
  pdf.setFont('helvetica')

  // 제목 영역
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text('APPROVAL DOCUMENT', pageWidth / 2, 20, { align: 'center' })

  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Document No: ${doc.documentNo}`, pageWidth / 2, 28, { align: 'center' })

  // 구분선
  pdf.setLineWidth(0.5)
  pdf.line(15, 33, pageWidth - 15, 33)

  // 문서 정보
  let y = 40
  pdf.setFontSize(10)

  const infoData = [
    ['Title', doc.title],
    ['Drafter', `${doc.drafter.nameKo} / ${doc.drafter.department?.name || '-'} / ${doc.drafter.position?.name || '-'}`],
    ['Draft Date', doc.draftDate],
    ['Urgency', URGENCY_MAP[doc.urgency] || doc.urgency],
    ['Status', STATUS_MAP[doc.status] || doc.status],
  ]

  ;(pdf as any).autoTable({
    startY: y,
    body: infoData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 15, right: 15 },
  })

  y = (pdf as any).lastAutoTable.finalY + 10

  // 결재선
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.text('Approval Line', 15, y)
  y += 3

  const stepData = doc.steps.map((s) => [
    String(s.stepOrder),
    s.approver.nameKo,
    s.approver.position?.name || '-',
    s.approver.department?.name || '-',
    STATUS_MAP[s.status] || s.status,
    s.comment || '-',
    s.actionDate ? new Date(s.actionDate).toLocaleDateString() : '-',
  ])

  ;(pdf as any).autoTable({
    startY: y,
    head: [['No', 'Name', 'Position', 'Dept', 'Status', 'Comment', 'Date']],
    body: stepData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    margin: { left: 15, right: 15 },
  })

  y = (pdf as any).lastAutoTable.finalY + 10

  // 본문
  if (doc.content?.body) {
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Content', 15, y)
    y += 5

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    // 텍스트를 줄바꿈 처리
    const lines = pdf.splitTextToSize(doc.content.body, pageWidth - 30)
    pdf.text(lines, 15, y)
    y += lines.length * 5
  }

  // 추가 정보 (금액, 기간 등)
  if (doc.content?.amount || doc.content?.period || doc.content?.destination) {
    y += 5
    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Details', 15, y)
    y += 3

    const detailData: string[][] = []
    if (doc.content.amount) detailData.push(['Amount', doc.content.amount])
    if (doc.content.period) detailData.push(['Period', doc.content.period])
    if (doc.content.destination) detailData.push(['Destination', doc.content.destination])
    if (doc.content.purpose) detailData.push(['Purpose', doc.content.purpose])

    if (detailData.length > 0) {
      ;(pdf as any).autoTable({
        startY: y,
        body: detailData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
        margin: { left: 15, right: 15 },
      })
    }
  }

  // 푸터
  const pageCount = (pdf as any).getNumberOfPages?.() || pdf.internal.pages.length - 1
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text(
      `Generated: ${new Date().toLocaleDateString()} | Page ${i}/${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // 다운로드
  pdf.save(`${doc.documentNo}_${doc.title}.pdf`)
}
