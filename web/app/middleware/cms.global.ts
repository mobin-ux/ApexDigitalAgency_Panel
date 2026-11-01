import type { CmsDocumentLike } from '~/composables/useCmsContent'
import { normalisePath } from '#shared/cms'

/**
 * Loads what the admin console has published for the page being opened,
 * and the site chrome once, before the page's setup runs (ADR-026).
 *
 * Pages copy values out of their content during setup (an article's title
 * into its schema.org block, for one), so the published words have to be
 * in hand by then; a fetch started inside the component would still be in
 * flight and leave those copies on the code baseline. The answers are kept
 * in shared state, serialised into the payload, so hydration does not fetch
 * them again. A failed read stores null: the page renders its baseline.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/preview/')) {
    return
  }
  const path = normalisePath(to.path)
  const pages = useCmsPageState()
  const globals = useCmsGlobalState()
  const tasks: Promise<unknown>[] = []
  if (!(path in pages.value)) {
    tasks.push($fetch<{ document: CmsDocumentLike | null }>('/api/cms/page', { query: { path } })
      .then((res) => { pages.value = { ...pages.value, [path]: res.document } })
      .catch(() => { pages.value = { ...pages.value, [path]: null } }))
  }
  if (globals.value === null) {
    tasks.push($fetch<{ globals: Record<string, CmsDocumentLike> }>('/api/cms/globals')
      .then((res) => { globals.value = res.globals })
      .catch(() => { globals.value = {} }))
  }
  await Promise.all(tasks)
})
