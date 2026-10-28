import type { LinkValue } from '#shared/cms'

/**
 * Turn a stored link into the props a `NuxtLink`/`UiButton` takes: an
 * internal path is routed, a panel key is resolved through `usePanelLinks()`
 * (so the panel's base URL never lives in content) and an external address
 * is a plain href. The contract already refused anything but those three.
 */
export function useCmsLink() {
  const panel = usePanelLinks()
  function linkAttrs(link: LinkValue): { to: string } | { href: string } {
    switch (link.kind) {
      case 'internal':
        return { to: link.path }
      case 'panel':
        return { href: panel[link.key] }
      case 'external':
        return { href: link.url }
    }
  }
  /** The same link as one string, for places that take a plain `to`. */
  function linkHref(link: LinkValue): string {
    const attrs = linkAttrs(link)
    return 'to' in attrs ? attrs.to : attrs.href
  }
  return { linkAttrs, linkHref }
}
