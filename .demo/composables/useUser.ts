export const useUser = () => {
  // متغیر سراسری برای نگهداری اطلاعات کاربر
  const user = useState<any>('user', () => null)

  // تابع دریافت اطلاعات کاربر از سرور
  const fetchUser = async () => {
    try {
      const data = await $fetch<{ user: any }>('/api/auth/me')
      if (data && data.user) {
        user.value = data.user
      }
    } catch (e) {
      user.value = null
    }
  }

  // تابع خروج
  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      // Ignore error
    } finally {
      user.value = null
      navigateTo('/auth/login-1')
    }
  }

  return { user, fetchUser, logout }
}
