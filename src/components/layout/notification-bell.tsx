'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from '@/lib/format'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

const TYPE_ICONS: Record<string, string> = {
  APPROVAL: '📋',
  LEAVE: '🏖️',
  STOCK: '📦',
  SYSTEM: '⚙️',
  MESSAGE: '💬',
  BOARD: '📢',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get(`/notifications?pageSize=${isMobile ? 15 : 30}`) as Promise<any>,
    refetchInterval: isMobile ? 60000 : 30000, // 모바일 60초, 데스크톱 30초
    refetchIntervalInBackground: false, // 탭 비활성 시 폴링 중단
  })

  const actionMutation = useMutation({
    mutationFn: (body: any) => api.put('/notifications', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.data || []
  const unreadCount = data?.meta?.totalCount || 0

  const handleClick = (notif: any) => {
    if (!notif.isRead) {
      actionMutation.mutate({ action: 'read', id: notif.id })
    }
    if (notif.relatedUrl) {
      router.push(notif.relatedUrl)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-16px)] sm:w-80 p-0 max-h-[80dvh]" align="end" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">알림</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => actionMutation.mutate({ action: 'readAll' })}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                전체 읽음
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-[60dvh] sm:max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              알림이 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif: any) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !notif.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => handleClick(notif)}
                >
                  <span className="text-lg mt-0.5">{TYPE_ICONS[notif.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{notif.title}</p>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {notif.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(notif.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="border-t px-4 py-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => actionMutation.mutate({ action: 'deleteAll' })}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              읽은 알림 삭제
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
