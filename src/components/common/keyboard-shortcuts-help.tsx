'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SHORTCUT_LIST } from '@/hooks/use-keyboard-shortcuts'
import { Keyboard } from 'lucide-react'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
}: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            키보드 단축키
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          {SHORTCUT_LIST.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between py-1.5 px-1"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <div className="flex gap-1">
                {shortcut.keys.split('+').map((key) => (
                  <kbd
                    key={key}
                    className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border bg-muted px-1.5 text-xs font-medium"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          <kbd className="inline-flex h-5 min-w-[1rem] items-center justify-center rounded border bg-muted px-1 text-[10px] font-medium">?</kbd>
          {' '}를 눌러 이 도움말을 열고 닫을 수 있습니다
        </p>
      </DialogContent>
    </Dialog>
  )
}
