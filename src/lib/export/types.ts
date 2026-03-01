// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExportRow = Record<string, any>

export interface ExportColumn {
  header: string
  accessor: string | ((row: ExportRow) => unknown)
  width?: number
}

export interface ExportConfig {
  fileName: string
  sheetName?: string
  title?: string
  columns: ExportColumn[]
  data: ExportRow[]
}

export interface TemplateColumn {
  header: string
  key: string
  example?: string
  width?: number
  required?: boolean
}

export interface TemplateConfig {
  fileName: string
  sheetName?: string
  columns: TemplateColumn[]
}
