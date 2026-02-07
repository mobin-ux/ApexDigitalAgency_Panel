export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, fetchUser } = useUser()
  
  // ۱. چک کردن کوکی در مرورگر
  const token = useCookie('auth_token')

  // ۲. اگر اصلا کوکی ندارد، یعنی قطعا لاگین نیست -> برو بیرون
  if (!token.value) {
    return navigateTo('/auth/login-1')
  }

  // ۳. اگر کوکی دارد اما اطلاعات کاربر در رم نیست (رفرش شده) -> برو بگیر
  if (!user.value) {
    await fetchUser()
  }

  // ۴. اگر بعد از تلاش برای گرفتن، باز هم کاربر null بود -> یعنی کوکی فیک یا منقضی است -> برو بیرون
  if (!user.value) {
    return navigateTo('/auth/login-1')
  }
})