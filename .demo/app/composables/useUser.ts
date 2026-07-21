/**
 * Session state for the customer and admin panels.
 *
 * The `auth_token` cookie is httpOnly, so nothing here can read or clear it
 * directly — the server owns the session. `fetchUser()` is the only source
 * of truth about who is signed in, and `logout()` must go through the API
 * so the cookie is cleared with the same attributes it was set with.
 */
export function useUser() {
  const user = useState<any>('user', () => null)

  /**
   * Load the signed-in user from the server.
   *
   * `useRequestFetch()` forwards the incoming request's cookies during SSR,
   * which is what keeps a hard refresh or direct navigation to a protected
   * page signed in — plain `$fetch` drops the cookie and bounces to login.
   */
  const fetchUser = async (options?: { force?: boolean }) => {
    if (user.value && !options?.force) {
      return
    }

    try {
      const requestFetch = useRequestFetch()
      const { user: fetchedUser } = await requestFetch<{ user: any }>('/api/auth/me')
      user.value = fetchedUser ?? null
    }
    catch {
      user.value = null
    }
  }

  const setUser = (newUser: any) => {
    user.value = newUser
  }

  /**
   * Sign out. The server clears the httpOnly cookie; we clear local state
   * regardless of the response so a network failure can't strand the user
   * in a half-signed-in UI.
   */
  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    }
    catch {
      // Ignored on purpose — see above.
    }
    user.value = null
    await navigateTo('/auth/login-1')
  }

  return { user, fetchUser, setUser, logout }
}
