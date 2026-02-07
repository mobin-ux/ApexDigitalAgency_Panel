export const useNotifications = () => {
  const notifications = useState<any[]>('notifications_list', () => [])
  const unreadCount = useState<number>('notifications_count', () => 0)

  const fetchNotifications = async () => {
    try {
      const { notifications: list, unreadCount: count } = await $fetch('/api/notifications')
      notifications.value = list
      unreadCount.value = count
    } catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    if (unreadCount.value === 0) return
    
    // Optimistic update (سریع صفرش کن تا کاربر حس خوبی بگیره)
    unreadCount.value = 0
    notifications.value.forEach(n => n.isRead = true)

    try {
      await $fetch('/api/notifications/mark-read', { method: 'POST' })
    } catch (e) {
      // اگر خطا داد برگردان (اختیاری)
    }
  }

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAllAsRead
  }
}