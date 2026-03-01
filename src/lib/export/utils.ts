/**
 * Export 모듈 공통 유틸리티
 * - getValue: 행 데이터에서 accessor 기반 값 추출
 * - triggerDownload: Blob 기반 브라우저 파일 다운로드
 */

import type { ExportRow } from './types'

/** 행 데이터에서 accessor(문자열 경로 또는 함수)를 사용해 값 추출 */
export function getValue(row: ExportRow, accessor: string | ((row: ExportRow) => unknown)): unknown {
  if (typeof accessor === 'function') return accessor(row)
  return (
    accessor.split('.').reduce((obj: ExportRow | undefined, key) => {
      if (obj == null) return undefined
      return obj[key] as ExportRow | undefined
    }, row as ExportRow) ?? ''
  )
}

/** Blob을 브라우저 파일 다운로드로 트리거 */
export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 대용량 파일(50MB 이하) 다운로드가 완료되기 전에 revoke되는 문제 방지
  // 60초 후 cleanup (3초에서 증가)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
