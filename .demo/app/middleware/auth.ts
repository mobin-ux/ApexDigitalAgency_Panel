export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useUser()

  // اگر اطلاعات کاربر نیست، آن را بگیر
  if (!user.value) {
    await fetchUser()
  }

  // اگر هنوز کاربر null است، یعنی لاگین نیست -> هدایت به لاگین
  if (!user.value) {
    return navigateTo('/auth/login-1')
  }
})

