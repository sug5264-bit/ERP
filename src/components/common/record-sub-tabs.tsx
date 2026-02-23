'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Download, Trash2, Send } from 'lucide-react'
import { formatDate } from '@/lib/format'

interface RecordSubTabsProps {
  relatedTable: string
  relatedId?: string
  // Create mode (local state managed by parent)
  pendingFiles?: File[]
  onPendingFilesChange?: (files: File[]) => void
  pendingNote?: string
  onPendingNoteChange?: (v: string) => void
}

/**
 * 특이사항(파일 첨부) + 게시글 서브 탭 컨텐츠.
 * 부모 컴포넌트의 <Tabs> 안에 배치하며,
 * value="files" 와 value="notes" TabsContent를 렌더합니다.
 */
export function RecordSubTabs({
  relatedTable,
  relatedId,
  pendingFiles,
  onPendingFilesChange,
  pendingNote,
  onPendingNoteChange,
}: RecordSubTabsProps) {
  const isEditMode = !!relatedId
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [newNote, setNewNote] = useState('')

  const { data: attachmentsData } = useQuery({
    queryKey: ['attachments', relatedTable, relatedId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/attachments?relatedTable=${relatedTable}&relatedId=${relatedId}`)
      return res.json()
    },
    enabled: isEditMode,
  })

  const { data: notesData } = useQuery({
    queryKey: ['notes', relatedTable, relatedId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/notes?relatedTable=${relatedTable}&relatedId=${relatedId}`)
      return res.json()
    },
    enabled: isEditMode,
  })

  const attachments = attachmentsData?.data || []
  const notes = notesData?.data || []

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (isEditMode) {
      uploadFile(file)
    } else {
      onPendingFilesChange?.([...(pendingFiles || []), file])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const uploadFile = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('relatedTable', relatedTable)
    formData.append('relatedId', relatedId!)
    try {
      const res = await fetch('/api/v1/attachments', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['attachments', relatedTable, relatedId] })
      toast.success('파일이 업로드되었습니다.')
    } catch {
      toast.error('파일 업로드에 실패했습니다.')
    }
  }

  const handleDeleteAttachment = async (id: string) => {
    try {
      await fetch(`/api/v1/attachments/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['attachments', relatedTable, relatedId] })
      toast.success('파일이 삭제되었습니다.')
    } catch {
      toast.error('파일 삭제에 실패했습니다.')
    }
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    try {
      const res = await fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote, relatedTable, relatedId }),
      })
      if (!res.ok) throw new Error()
      queryClient.invalidateQueries({ queryKey: ['notes', relatedTable, relatedId] })
      setNewNote('')
      toast.success('게시글이 등록되었습니다.')
    } catch {
      toast.error('게시글 등록에 실패했습니다.')
    }
  }

  const handleDeleteNote = async (id: string) => {
    try {
      await fetch(`/api/v1/notes/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['notes', relatedTable, relatedId] })
      toast.success('게시글이 삭제되었습니다.')
    } catch {
      toast.error('게시글 삭제에 실패했습니다.')
    }
  }

  return (
    <>
      {/* 특이사항 (파일 첨부) 탭 */}
      <TabsContent value="files" className="space-y-3 pt-3">
        <div className="flex items-center gap-2">
          <Input ref={fileInputRef} type="file" onChange={handleFileSelect} className="flex-1" />
        </div>

        {/* Create mode: pending files list */}
        {!isEditMode && pendingFiles && pendingFiles.length > 0 && (
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">선택한 파일</Label>
            {pendingFiles.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">
                  {f.name} <span className="text-muted-foreground">({(f.size / 1024).toFixed(1)}KB)</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onPendingFilesChange?.(pendingFiles.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Create mode: pending note textarea */}
        {!isEditMode && (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">특이사항 메모</Label>
            <Textarea
              placeholder="특이사항을 입력하세요..."
              value={pendingNote || ''}
              onChange={(e) => onPendingNoteChange?.(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Edit mode: existing files */}
        {isEditMode && attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((att: any) => (
              <div key={att.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span className="truncate">
                  {att.fileName} <span className="text-muted-foreground">({(att.fileSize / 1024).toFixed(1)}KB)</span>
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(`/api/v1/attachments/${att.id}`, '_blank')}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDeleteAttachment(att.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {isEditMode && attachments.length === 0 && (
          <p className="text-muted-foreground py-2 text-sm">첨부된 파일이 없습니다.</p>
        )}
      </TabsContent>

      {/* 게시글 탭 */}
      <TabsContent value="notes" className="space-y-3 pt-3">
        {isEditMode ? (
          <div className="flex gap-2">
            <Textarea
              placeholder="게시글을 작성하세요..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              className="flex-1"
            />
            <Button type="button" onClick={handleAddNote} disabled={!newNote.trim()} className="self-end" size="sm">
              <Send className="mr-1 h-3.5 w-3.5" />
              등록
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">게시글 (등록 후 저장됩니다)</Label>
            <Textarea
              placeholder="게시글을 작성하세요..."
              value={pendingNote || ''}
              onChange={(e) => onPendingNoteChange?.(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Edit mode: existing notes */}
        {isEditMode && notes.length > 0 && (
          <div className="space-y-2">
            {notes.map((note: any) => (
              <div key={note.id} className="space-y-1 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm break-all whitespace-pre-wrap">{note.content}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => handleDeleteNote(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-muted-foreground text-xs">{formatDate(note.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
        {isEditMode && notes.length === 0 && (
          <p className="text-muted-foreground py-2 text-sm">작성된 게시글이 없습니다.</p>
        )}
      </TabsContent>
    </>
  )
}

/**
 * 레코드 생성 후 대기 중인 파일/게시글을 저장합니다.
 */
export async function savePendingData(relatedTable: string, relatedId: string, files: File[], noteContent: string) {
  const promises: Promise<any>[] = []

  for (const file of files) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('relatedTable', relatedTable)
    formData.append('relatedId', relatedId)
    promises.push(fetch('/api/v1/attachments', { method: 'POST', body: formData }))
  }

  if (noteContent.trim()) {
    promises.push(
      fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent, relatedTable, relatedId }),
      })
    )
  }

  await Promise.allSettled(promises)
}
