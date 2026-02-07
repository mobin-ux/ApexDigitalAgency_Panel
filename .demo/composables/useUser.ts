export const useUser = () => {
  // state اصلی کاربر
  const user = useState<any>('user', () => null)

  // تابع دریافت کاربر از سرور
  const fetchUser = async () => {
    // اگر قبلاً یوزر را داریم، دوباره نگیر (مگر اینکه بخواهیم فورس کنیم)
    if (user.value) return

    try {
      const { user: fetchedUser } = await $fetch('/api/auth/me')
      if (fetchedUser) {
        user.value = fetchedUser
      } else {
        user.value = null
      }
    } catch (e) {
      user.value = null
    }
  }

  // تابع لاگین دستی
  const setUser = (newUser: any) => {
    user.value = newUser
  }

  // تابع خروج
  const logout = async () => {
    user.value = null
    const token = useCookie('auth_token')
    token.value = null
    await navigateTo('/auth/login-1')
  }

  return {
    user,
    fetchUser,
    setUser,
    logout
  }
}