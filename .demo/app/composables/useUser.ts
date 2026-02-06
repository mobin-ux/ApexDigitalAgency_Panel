export const useUser = () => {
  // State: نگهداری اطلاعات کاربر در رم مرورگر
  const user = useState<any>('user', () => null)

  // Action: دریافت اطلاعات از سرور
  const fetchUser = async () => {
    try {
      const { user: userData } = await $fetch<any>('/api/auth/me')
      user.value = userData
    } catch (error) {
      user.value = null
    }
  }

  // Action: خروج
  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error(error)
    } finally {
      user.value = null
      return navigateTo('/auth/login-1')
    }
  }

  return { user, fetchUser, logout }
}

