export const useUser = () => {
  // state اصلی کاربر
  const user = useState<any>('user', () => null)

  // تابع دریافت کاربر از سرور
  const fetchUser = async () => {
    // اگر قبلاً یوزر را داریم، دوباره نگیر (مگر اینکه بخواهیم فورس کنیم)
    if (user.value) return

    try {
      // useRequestFetch forwards the incoming request cookies during SSR, so a
      // hard refresh / direct navigation to a protected page stays logged in
      // (plain $fetch would drop the auth_token cookie and bounce to login).
      const requestFetch = useRequestFetch()
      const { user: fetchedUser } = await requestFetch('/api/auth/me')
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