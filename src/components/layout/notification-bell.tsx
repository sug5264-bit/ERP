'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/hooks/use-api'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from '@/lib/format'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  relatedUrl: string | null
  createdAt: string
}

interface NotificationsResponse {
  data?: {
    notifications: Notification[]
    unreadCount: number
  }
}

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

  const notifQueryKey = ['notifications'] as const

  const { data } = useQuery({
    queryKey: notifQueryKey,
    queryFn: () => api.get(`/notifications?pageSize=${isMobile ? 15 : 30}`) as Promise<NotificationsResponse>,
    refetchInterval: isMobile ? 60000 : 30000,
    refetchIntervalInBackground: false,
  })

  const actionMutation = useMutation({
    mutationFn: (body: { action: string; id?: string }) => api.put('/notifications', body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: notifQueryKey })
      const prev = queryClient.getQueryData(notifQueryKey)

      // Optimistic update
      queryClient.setQueryData(notifQueryKey, (old: NotificationsResponse | undefined) => {
        if (!old?.data) return old
        const notifs = old.data.notifications || []
        const unread = old.data.unreadCount || 0
        if (body.action === 'read' && body.id) {
          const wasUnread = notifs.find((n) => n.id === body.id && !n.isRead)
          return {
            ...old,
            data: {
              ...old.data,
              notifications: notifs.map((n) => (n.id === body.id ? { ...n, isRead: true } : n)),
              unreadCount: wasUnread ? Math.max(0, unread - 1) : unread,
            },
          }
        }
        if (body.action === 'readAll') {
          return {
            ...old,
            data: {
              ...old.data,
              notifications: notifs.map((n) => ({ ...n, isRead: true })),
              unreadCount: 0,
            },
          }
        }
        if (body.action === 'deleteAll') {
          return {
            ...old,
            data: {
              ...old.data,
              notifications: notifs.filter((n) => !n.isRead),
            },
          }
        }
        return old
      })

      return { prev }
    },
    onError: (_err, _body, context) => {
      if (context?.prev) {
        queryClient.setQueryData(notifQueryKey, context.prev)
      }
    },
    onSettled: (_data, error) => {
      // 실패 시에만 서버 데이터 재요청 (성공 시 optimistic update가 유효)
      if (error) {
        queryClient.invalidateQueries({ queryKey: notifQueryKey })
      }
    },
  })

  const notifications = data?.data?.notifications || []
  const unreadCount = data?.data?.unreadCount || 0

  const handleClick = (notif: Notification) => {
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
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount > 0 ? `알림 ${unreadCount}건` : '알림'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[80dvh] w-[calc(100vw-16px)] p-0 sm:w-80" align="end" sideOffset={8}>
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
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <div className="bg-muted rounded-full p-3">
                <Bell className="text-muted-foreground/40 h-6 w-6" />
              </div>
              <p className="text-muted-foreground text-sm">새로운 알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  type="button"
                  className={`hover:bg-muted/50 flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors ${
                    !notif.isRead ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleClick(notif)}
                >
                  <span className="mt-0.5 text-lg">{TYPE_ICONS[notif.type] || '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{notif.title}</p>
                      {!notif.isRead && <span className="bg-primary h-2 w-2 shrink-0 rounded-full" />}
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{notif.message}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{formatDistanceToNow(notif.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="flex justify-center border-t px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
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
