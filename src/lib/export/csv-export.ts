import type { ExportConfig } from './types'

function getValue(row: any, accessor: string | ((row: any) => any)): string {
  let val: any
  if (typeof accessor === 'function') val = accessor(row)
  else val = accessor.split('.').reduce((obj, key) => obj?.[key], row)
  if (val == null) return ''
  let str = String(val)
  // CSV 수식 인젝션 방지: 셀이 =, +, -, @, \t, \r 로 시작하면 앞에 작은따옴표 추가
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  // CSV 이스케이프: 쉼표, 줄바꿈, 따옴표가 포함된 경우
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportToCSV(config: ExportConfig) {
  const { fileName, columns, data } = config

  // BOM (UTF-8 with BOM for Excel 한글 호환)
  const BOM = '\uFEFF'

  const header = columns.map((c) => getValue({}, () => c.header)).join(',')
  const rows = data.map((row) =>
    columns.map((col) => getValue(row, col.accessor)).join(',')
  )

  const csv = BOM + [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
