import type { LinkValue } from '#shared/cms'

/**
 * Turn a content link into the props a `NuxtLink`/`UiButton` takes: an
 * internal path is routed and an external address is a plain href. The
 * contract refuses anything but those two.
 */
export function useCmsLink() {
  function linkAttrs(link: LinkValue): { to: string } | { href: string } {
    switch (link.kind) {
      case 'internal':
        return { to: link.path }
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
