export default defineNuxtPlugin(async (nuxtApp) => {
  const { user, fetchUser } = useUser()

  // اگر اطلاعات کاربر هنوز لود نشده، آن را از سرور بگیر
  if (!user.value) {
    await fetchUser()
  }
})