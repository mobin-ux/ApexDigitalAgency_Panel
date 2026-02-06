export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, fetchUser } = useUser()

  // 1. Fetch user if not loaded
  if (!user.value) {
    await fetchUser()
  }

  // 2. Public Routes (No login required)
  const publicRoutes = [
    '/auth/login-1',
    '/auth/signup-1',
    '/auth/recover'
  ]

  // 3. Logic
  const isPublic = publicRoutes.includes(to.path)
  const isLoggedIn = !!user.value

  // Redirect to login if accessing protected page while logged out
  if (!isLoggedIn && !isPublic) {
    return navigateTo('/auth/login-1')
  }

  // Redirect to home if accessing login page while logged in
  if (isLoggedIn && isPublic) {
    return navigateTo('/')
  }
})
