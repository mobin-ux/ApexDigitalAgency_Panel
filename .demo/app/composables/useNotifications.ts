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

  // One row, when it is opened. Optimistic for the same reason as above; the
  // navigation it rides on is not held up waiting for the server.
  const markRead = async (id: string) => {
    const row = notifications.value.find(n => n.id === id)
    if (!row || row.isRead)
      return

    notifications.value = notifications.value.map(n => (n.id === id ? { ...n, isRead: true } : n))
    unreadCount.value = Math.max(0, unreadCount.value - 1)

    try {
      await $fetch(`/api/notifications/${id}/read`, { method: 'POST' })
    }
    catch {
      notifications.value = notifications.value.map(n => (n.id === id ? { ...n, isRead: false } : n))
      unreadCount.value += 1
    }
  }

  return {
    notifications,
    unreadCount,
    fetchNotifications,
    markAllAsRead,
    markRead,
  }
}
