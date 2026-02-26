'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { readExcelFile, downloadImportTemplate, type TemplateColumn } from '@/lib/export'
import { api } from '@/hooks/use-api'
import { toast } from 'sonner'
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react'

interface ExcelImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  apiEndpoint: string
  templateColumns: TemplateColumn[]
  templateFileName: string
  keyMap: Record<string, string>
  onSuccess?: () => void
}

interface ImportResult {
  success: number
  failed: number
  errors: { row: number; message: string }[]
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  title,
  apiEndpoint,
  templateColumns,
  templateFileName,
  keyMap,
  onSuccess,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setParsedRows([])
    setImporting(false)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const handleClose = (v: boolean) => {
    if (!v) reset()
    onOpenChange(v)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    try {
      const rows = await readExcelFile(f, keyMap)
      setParsedRows(rows)
    } catch (err: any) {
      toast.error(err.message || '파일을 읽을 수 없습니다.')
      reset()
    }
  }

  const handleTemplate = () => {
    downloadImportTemplate({ fileName: templateFileName, columns: templateColumns })
  }

  const handleImport = async () => {
    if (!file || parsedRows.length === 0) return
    setImporting(true)
    try {
      // 이미 파싱된 데이터를 재사용 (파일을 다시 읽지 않음)
      const res = (await api.post(apiEndpoint, { rows: parsedRows })) as any
      const body = res.data ?? res
      const importResult: ImportResult = {
        success: body.success || 0,
        failed: body.failed || 0,
        errors: body.errors || [],
      }
      setResult(importResult)
      if (importResult.success > 0) {
        toast.success(`${importResult.success}건이 등록되었습니다.`)
        onSuccess?.()
      }
      if (importResult.failed > 0) {
        toast.error(`${importResult.failed}건 실패`)
      }
    } catch (err: any) {
      toast.error(err.message || '업로드에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  const preview = parsedRows.slice(0, 5)
  const previewKeys = preview.length > 0 ? Object.keys(preview[0]) : []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto sm:max-w-xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleTemplate}>
              <Download className="mr-1 h-4 w-4" /> 템플릿 다운로드
            </Button>
            <span className="text-muted-foreground text-xs">
              템플릿을 다운로드하여 데이터를 입력한 후 업로드하세요.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={importing}>
              <FileSpreadsheet className="mr-1 h-4 w-4" /> 파일 선택
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
            {file && (
              <span className="text-muted-foreground text-sm">
                {file.name} ({parsedRows.length}건)
              </span>
            )}
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">미리보기 (상위 {preview.length}건)</p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      {previewKeys.map((k) => (
                        <th key={k} className="p-2 text-left whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b">
                        {previewKeys.map((k) => (
                          <td key={k} className="max-w-[200px] truncate p-2 whitespace-nowrap">
                            {row[k] != null ? String(row[k]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <p className="text-muted-foreground text-xs">... 외 {parsedRows.length - 5}건</p>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-md border p-4">
              <p className="text-sm font-medium">업로드 결과</p>
              <div className="flex gap-4 text-sm">
                <span className="text-status-success flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> 성공: {result.success}건
                </span>
                {result.failed > 0 && (
                  <span className="text-destructive flex items-center gap-1">
                    <XCircle className="h-4 w-4" /> 실패: {result.failed}건
                  </span>
                )}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded border p-2">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-destructive text-xs">
                      {e.row}행: {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            닫기
          </Button>
          <Button onClick={handleImport} disabled={!file || parsedRows.length === 0 || importing}>
            <Upload className="mr-1 h-4 w-4" />
            {importing ? '업로드 중...' : `${parsedRows.length}건 업로드`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
