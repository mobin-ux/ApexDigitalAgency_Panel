import type { Collection, DocumentStatus, ReviewState } from '~~/shared/cms'

/** One row of the Pages, Insights and Case studies lists (`GET /api/admin/website/documents`). */
export interface WebsiteDocRow {
  id: string
  title: string
  path: string | null
  template: string
  collection: Collection
  type: string
  built: boolean
  meta: Record<string, unknown> | null
  status: DocumentStatus
  review: ReviewState
  dirty: boolean
  chip: { key: string, label: string, tone: 'neutral' | 'warning' | 'success' | 'info' }
  updatedAt: string
  updatedBy: string | null
  submittedBy: string | null
  publishedAt: string | null
}

export type WebsiteListCollection = Exclude<Collection, 'chrome'>

const NEW: Record<WebsiteListCollection, { template: 'built-page' | 'built-article' | 'built-case-study', title: string, base: string }> = {
  pages: { template: 'built-page', title: 'Untitled page', base: '/' },
  insights: { template: 'built-article', title: 'Untitled article', base: '/insights/' },
  work: { template: 'built-case-study', title: 'Untitled case study', base: '/our-work/' },
}

/**
 * The Website screens' two list actions (`Admin Console.dc.html` `newDoc`):
 * a new document opens straight in the editor as an untitled draft at a
 * placeholder address, which its SEO tab renames; and Import brings the
 * site's own pages in as published documents.
 */
export function useWebsiteDocs() {
  const toaster = useNuiToasts()
  const busy = ref(false)

  async function createDocument(collection: WebsiteListCollection) {
    if (busy.value) {
      return
    }
    busy.value = true
    const spec = NEW[collection]
    try {
      const suffix = String(Date.now()).slice(-6)
      const result = await $fetch<{ editor: string }>('/api/admin/website/documents', {
        method: 'POST',
        body: { template: spec.template, title: spec.title, path: `${spec.base}untitled-${suffix}` },
      })
      await navigateTo(result.editor)
    }
    catch (error) {
      toaster.add({ title: 'Not created', description: errorMessage(error), icon: 'lucide:alert-triangle', progress: true })
    }
    finally {
      busy.value = false
    }
  }

  async function importSite(after?: () => unknown) {
    if (busy.value) {
      return
    }
    busy.value = true
    try {
      const result = await $fetch<{ created: number, skipped: { key: string, reason: string }[] }>('/api/admin/website/import', { method: 'POST' })
      const skipped = result.skipped.length ? ` ${result.skipped.length} could not be read and were left out.` : ''
      toaster.add({
        title: result.created ? `${result.created} page${result.created === 1 ? '' : 's'} imported` : 'Nothing new to import',
        description: result.created ? `They are published with the words already on the site, so visitors see no change.${skipped}` : `Every page on the site already has a document here.${skipped}`,
        icon: 'lucide:check',
        progress: true,
      })
      await after?.()
    }
    catch (error) {
      toaster.add({ title: 'Not imported', description: errorMessage(error), icon: 'lucide:alert-triangle', progress: true })
    }
    finally {
      busy.value = false
    }
  }

  return { busy, createDocument, importSite }
}
