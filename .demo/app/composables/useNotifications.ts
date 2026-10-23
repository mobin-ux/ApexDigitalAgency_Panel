export function useNotifications() {
  const notifications = useState<any[]>('notifications_list', () => [])
  const unreadCount = useState<number>('notifications_count', () => 0)

  const fetchNotifications = async () => {
    try {
      const { notifications: list, unreadCount: count } = await $fetch('/api/notifications')
      notifications.value = list
      unreadCount.value = count
    }
    catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    if (unreadCount.value === 0)
      return

    // Optimistic, so the badge clears the moment it is clicked. If the server
    // refuses, the rows and the count go back to what they were rather than
    // reading as handled until the next page load brings them back.
    const before = { count: unreadCount.value, list: notifications.value }
    unreadCount.value = 0
    notifications.value = notifications.value.map(n => ({ ...n, isRead: true }))

    try {
      await $fetch('/api/notifications/mark-read', { method: 'POST' })
    }
    catch {
      unreadCount.value = before.count
      notifications.value = before.list
    }
  }

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAllAsRead,
  }
}
