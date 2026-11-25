import { apiRequest } from '@/api/client'

export interface NotificationItem {
  id: string
  user: string
  notification_type: string
  title: string
  message: string
  related_task: string | null
  related_task_title: string | null
  related_project: string | null
  related_project_code: string | null
  related_project_name: string | null
  is_read: boolean
  created_at: string
  read_at: string | null
}

function unwrap<T>(data: T[] | { results?: T[] }): T[] {
  return Array.isArray(data) ? data : (data.results ?? [])
}

export const notificationsApi = {
  list: async (params?: { is_read?: string; notification_type?: string; mine?: boolean }) => {
    const qs = new URLSearchParams()
    if (params?.is_read) qs.set('is_read', params.is_read)
    if (params?.notification_type) qs.set('notification_type', params.notification_type)
    if (params?.mine) qs.set('mine', 'true')
    const query = qs.toString() ? `?${qs.toString()}` : ''
    const res = await apiRequest<NotificationItem[] | { results?: NotificationItem[] }>(
      `api/notifications/${query}`,
    )
    return unwrap(res)
  },

  markRead: (id: string) =>
    apiRequest<NotificationItem>(`api/notifications/${id}/mark_read/`, { method: 'POST' }),

  markAllRead: () =>
    apiRequest<{ marked_read: number }>('api/notifications/mark-all-read/', { method: 'POST' }),

  unreadCount: () =>
    apiRequest<{ unread_count: number }>('api/notifications/unread-count/'),
}
