export interface ExportColumn {
  header: string
  accessor: string | ((row: any) => any)
  width?: number
}

export interface ExportConfig {
  fileName: string
  sheetName?: string
  title?: string
  columns: ExportColumn[]
  data: any[]
}

export interface TemplateColumn {
  header: string
  key: string
  example?: string
  width?: number
}

export interface TemplateConfig {
  fileName: string
  sheetName?: string
  columns: TemplateColumn[]
}
