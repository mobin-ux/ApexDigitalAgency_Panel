/**
 * Lets a customer page take the phone's bottom edge from the five tabs while
 * one of its own screens owns it (a Support thread's composer, the wizard's
 * footer). The layout resets it on every route change, so a page that forgets
 * to hand the edge back cannot leave the tabs missing elsewhere.
 */
export function useApexBottomNav() {
  const hidden = useState('apex-hide-bottom-nav', () => false)
  return { hidden }
}
