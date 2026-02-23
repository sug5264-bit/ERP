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

// 폰트 캐시 (메모리)
let cachedFontBase64: string | null = null

// 한글 폰트 로드 헬퍼 - 로컬 우선, CDN 폴백
async function loadKoreanFont(pdf: InstanceType<typeof import('jspdf').default>): Promise<string> {
  if (cachedFontBase64) {
    pdf.addFileToVFS('korean.ttf', cachedFontBase64)
    pdf.addFont('korean.ttf', 'korean', 'normal')
    pdf.setFont('korean')
    return 'korean'
  }

  const fontUrls = [
    '/fonts/ipag.ttf',
    'https://cdn.jsdelivr.net/gh/psjdev/jsPDF-Korean-Fonts-Support@main/fonts/malgun.ttf',
    'https://fastly.jsdelivr.net/gh/psjdev/jsPDF-Korean-Fonts-Support@main/fonts/malgun.ttf',
  ]

  for (const fontUrl of fontUrls) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(fontUrl, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const bytes = new Uint8Array(arrayBuffer)
        const chunkSize = 8192
        let binary = ''
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
          binary += String.fromCharCode.apply(null, Array.from(chunk))
        }
        const base64 = btoa(binary)
        cachedFontBase64 = base64
        pdf.addFileToVFS('korean.ttf', base64)
        pdf.addFont('korean.ttf', 'korean', 'normal')
        pdf.setFont('korean')
        return 'korean'
      }
    } catch {
      continue
    }
  }

  return 'helvetica'
}

export async function exportApprovalPdf(doc: ApprovalDocExport) {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')

  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()

  // 한글 폰트 로드
  const fontName = await loadKoreanFont(pdf)

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
  pdf.setFontSize(10)

  const infoData = [
    ['제목', doc.title],
    ['기안자', `${doc.drafter.nameKo} / ${doc.drafter.department?.name || '-'} / ${doc.drafter.position?.name || '-'}`],
    ['기안일', doc.draftDate],
    ['긴급도', URGENCY_MAP[doc.urgency] || doc.urgency],
    ['상태', STATUS_MAP[doc.status] || doc.status],
  ]

  ;(pdf as any).autoTable({
    startY: y,
    body: infoData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3, font: fontName },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 35 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 15, right: 15 },
  })

  y = (pdf as any).lastAutoTable.finalY + 10

  // 결재선
  pdf.setFontSize(11)
  pdf.text('결재선', 15, y)
  y += 3

  const stepData = doc.steps.map((s) => [
    String(s.stepOrder),
    s.approver.nameKo,
    s.approver.position?.name || '-',
    s.approver.department?.name || '-',
    STATUS_MAP[s.status] || s.status,
    s.comment || '-',
    s.actionDate ? new Date(s.actionDate).toLocaleDateString('ko-KR') : '-',
  ])

  ;(pdf as any).autoTable({
    startY: y,
    head: [['순번', '결재자', '직급', '부서', '상태', '의견', '처리일']],
    body: stepData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2, font: fontName },
    headStyles: { fillColor: [68, 114, 196], textColor: 255, halign: 'center' },
    margin: { left: 15, right: 15 },
  })

  y = (pdf as any).lastAutoTable.finalY + 10

  // 본문
  if (doc.content?.body) {
    pdf.setFontSize(11)
    pdf.text('내용', 15, y)
    y += 5

    pdf.setFontSize(10)

    // 텍스트를 줄바꿈 처리
    const lines = pdf.splitTextToSize(doc.content.body, pageWidth - 30)
    pdf.text(lines, 15, y)
    y += lines.length * 5
  }

  // 추가 정보 (금액, 기간 등)
  if (doc.content?.amount || doc.content?.period || doc.content?.destination) {
    y += 5
    pdf.setFontSize(11)
    pdf.text('상세 정보', 15, y)
    y += 3

    const detailData: string[][] = []
    if (doc.content.amount) detailData.push(['금액', doc.content.amount])
    if (doc.content.period) detailData.push(['기간', doc.content.period])
    if (doc.content.destination) detailData.push(['목적지', doc.content.destination])
    if (doc.content.purpose) detailData.push(['목적', doc.content.purpose])

    if (detailData.length > 0) {
      ;(pdf as any).autoTable({
        startY: y,
        body: detailData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2, font: fontName },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
        margin: { left: 15, right: 15 },
      })
    }
  }

  // 푸터 (페이지 번호)
  const pageCount = (pdf as any).getNumberOfPages?.() || pdf.internal.pages.length - 1
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    pdf.text(
      `출력일: ${dateStr} | ${i} / ${pageCount}`,
      pageWidth / 2,
      pdf.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // 다운로드
  pdf.save(`${doc.documentNo}_${doc.title}.pdf`)
}
