import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to, from) => {
  const auth = useAuthStore()

  // لیست صفحاتی که نیاز به لاگین ندارند (عمومی هستند)
  const publicPages = ['/auth/login-1', '/auth/signup', '/auth/recover']
  
  // اگر کاربر می‌خواهد به یک صفحه عمومی برود، کاری نداریم
  const isPublicPage = publicPages.includes(to.path)

  // ۱. تلاش برای شناسایی کاربر (اگر رفرش کرده باشد)
  if (!auth.user) {
    await auth.fetchUser()
  }

  // ۲. سناریوی اول: کاربر لاگین نیست و می‌خواهد به صفحه خصوصی برود
  if (!auth.isLoggedIn && !isPublicPage) {
    return navigateTo('/auth/login-1')
  }

  // ۳. سناریوی دوم: کاربر لاگین است و می‌خواهد دوباره به صفحه لاگین برود
  if (auth.isLoggedIn && isPublicPage) {
    return navigateTo('/')
  }
})
