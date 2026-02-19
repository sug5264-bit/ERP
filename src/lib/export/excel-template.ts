import type { TemplateConfig } from './types'

export async function downloadImportTemplate(config: TemplateConfig) {
  const { default: ExcelJS } = await import('exceljs')

  const { fileName, sheetName = '데이터', columns } = config

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '웰그린 ERP'

  const sheet = workbook.addWorksheet(sheetName)

  // 헤더
  const headerRow = sheet.getRow(1)
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.required ? `${col.header} *` : col.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 24

  // 예시 행
  const hasExamples = columns.some((c) => c.example)
  if (hasExamples) {
    const exampleRow = sheet.getRow(2)
    columns.forEach((col, i) => {
      const cell = exampleRow.getCell(i + 1)
      cell.value = col.example || ''
      cell.font = { color: { argb: 'FF808080' }, italic: true }
    })
  }

  // 열 너비
  columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width || Math.max(col.header.length * 2 + 4, 14)
  })

  // 안내 시트
  const guideSheet = workbook.addWorksheet('안내사항')
  guideSheet.getColumn(1).width = 50
  guideSheet.getCell('A1').value = '업로드 안내사항'
  guideSheet.getCell('A1').font = { bold: true, size: 14 }
  guideSheet.getCell('A3').value = '1. 첫 번째 시트의 데이터를 입력해주세요.'
  guideSheet.getCell('A4').value = '2. 헤더(1행)는 수정하지 마세요.'
  guideSheet.getCell('A5').value = '3. * 표시가 있는 항목은 필수 입력입니다.'
  guideSheet.getCell('A6').value = '4. 2행의 예시 데이터는 삭제 후 입력하세요.'
  guideSheet.getCell('A7').value = '5. 파일 형식: .xlsx만 지원됩니다.'

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
