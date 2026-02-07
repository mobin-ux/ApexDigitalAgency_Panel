export default defineNuxtPlugin(async (nuxtApp) => {
  const { user, fetchUser } = useUser()

  // اگر کلاینت یا سرور در حال بالا آمدن است و یوزر خالی است، آن را چک کن
  if (!user.value) {
    await fetchUser()
  }
})