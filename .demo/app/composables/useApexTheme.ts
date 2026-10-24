/**
 * The panel's light/dark switch (Panel v2).
 *
 * One composable for the three places the design puts the control — the top
 * bar button, the account menu's segmented pair and Settings › Appearance — so
 * they cannot disagree. `@nuxtjs/color-mode` already persists the choice per
 * browser and writes the `.dark` class every token set keys on; this only
 * names the two values the panel offers.
 */
export function useApexTheme() {
  const colorMode = useColorMode()

  const isDark = computed(() => colorMode.value === 'dark')

  function setTheme(theme: 'light' | 'dark') {
    colorMode.preference = theme
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  const toggleLabel = computed(() => (isDark.value ? 'Switch to light theme' : 'Switch to dark theme'))
  const toggleIcon = computed(() => (isDark.value ? 'solar:sun-2-linear' : 'solar:moon-linear'))

  return { isDark, setTheme, toggleTheme, toggleLabel, toggleIcon }
}
