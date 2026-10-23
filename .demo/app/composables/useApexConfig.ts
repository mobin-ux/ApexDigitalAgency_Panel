/**
 * `/api/config`, once per page.
 *
 * The sidenav layout reads it for the maintenance banner and most pages read
 * it again for their own settings. Every `useFetch` call site gets a key of
 * its own, so each panel page fetched the same document twice and carried
 * two copies of it in the SSR payload. One explicit key shares the data, and
 * `dedupe: 'defer'` makes a second caller wait for the request already in
 * flight instead of cancelling it and starting another.
 */
export function useApexConfig(options: { lazy?: boolean } = {}) {
  return useFetch('/api/config', {
    key: 'apex-config',
    dedupe: 'defer',
    lazy: options.lazy ?? true,
  })
}
