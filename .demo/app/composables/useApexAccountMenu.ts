/**
 * Open state for the customer account menu. The design opens it from three
 * triggers (sidebar row, rail avatar, phone bar avatar) and renders it once,
 * so the state is shared rather than owned by any one of them.
 */
export function useApexAccountMenu() {
  const open = useState('apex-account-menu', () => false)
  /** The element that opened it, so focus can go back there on close. */
  const returnTo = useState<HTMLElement | null>('apex-account-menu-return', () => null)

  function show(event?: Event) {
    returnTo.value = (event?.currentTarget as HTMLElement | null) ?? null
    open.value = true
  }

  function close() {
    open.value = false
    nextTick(() => returnTo.value?.focus())
  }

  return { open, show, close }
}
