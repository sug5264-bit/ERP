import ExcelJS from 'exceljs'
import type { ExportConfig } from './types'

function getValue(row: any, accessor: string | ((row: any) => any)): any {
  if (typeof accessor === 'function') return accessor(row)
  return accessor.split('.').reduce((obj, key) => obj?.[key], row) ?? ''
}

export async function exportToExcel(config: ExportConfig) {
  const { fileName, sheetName = 'Sheet1', title, columns, data } = config

  const workbook = new ExcelJS.Workbook()
  workbook.creator = '웰그린 ERP'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(sheetName)

  let startRow = 1

  // 제목 행
  if (title) {
    sheet.mergeCells(1, 1, 1, columns.length)
    const titleCell = sheet.getCell(1, 1)
    titleCell.value = title
    titleCell.font = { size: 14, bold: true }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getRow(1).height = 30
    startRow = 3
  }

  // 헤더
  const headerRow = sheet.getRow(startRow)
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
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

  // 데이터
  data.forEach((row, rowIdx) => {
    const excelRow = sheet.getRow(startRow + 1 + rowIdx)
    columns.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1)
      cell.value = getValue(row, col.accessor)
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
    })
  })

  // 열 너비 자동 조정
  columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1)
    const maxLen = Math.max(
      col.header.length * 2,
      ...data.map((row) => String(getValue(row, col.accessor)).length)
    )
    column.width = col.width || Math.min(Math.max(maxLen + 2, 10), 40)
  })

  // 다운로드
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
