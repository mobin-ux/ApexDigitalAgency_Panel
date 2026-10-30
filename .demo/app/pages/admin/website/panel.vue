<script setup lang="ts">
import type { DisplayStatus } from '~~/shared/cms'
import { TEMPLATES } from '~~/shared/cms'

/**
 * Website — panel content (ADR-021). The customer-facing documents this
 * panel itself renders: the Terms and Privacy pages, the dashboard's
 * pay-monthly promo and the panel-wide announcement, plus the one feature
 * switch the module owns (whether customers can apply for credit). Each
 * document exists once; a missing one can be created here and then
 * follows the same draft → publish lifecycle as a web page. Customers see
 * only what is published.
 */
definePageMeta({
  title: 'Panel content',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))

const { data, pending, refresh, error } = await useFetch('/api/admin/website/documents', { query: { kind: 'panel', pageSize: 50 }, immediate: allowed.value })
const { data: config, refresh: refreshConfig } = await useFetch('/api/config', { key: 'apex-config-panel', immediate: allowed.value })

const SLOTS = [
  { template: 'legal' as const, key: 'terms', title: 'Terms of Service', detail: 'The document the sign-up consent points at. Shown at /legal/terms once published; a placeholder until then.' },
  { template: 'legal' as const, key: 'privacy', title: 'Privacy Policy', detail: 'Shown at /legal/privacy once published; a placeholder until then.' },
  { template: 'panel-promo' as const, key: 'dashboard-promo', title: TEMPLATES['panel-promo'].label, detail: TEMPLATES['panel-promo'].detail },
  { template: 'panel-announcement' as const, key: 'panel-announcement', title: TEMPLATES['panel-announcement'].label, detail: TEMPLATES['panel-announcement'].detail },
]

const rows = computed(() => SLOTS.map(slot => ({ ...slot, doc: data.value?.items.find(d => d.template === slot.template && d.key === slot.key) ?? null })))

const creating = ref<string | null>(null)
async function create(slot: typeof SLOTS[number]) {
  creating.value = slot.key
  try {
    const content = slot.template === 'legal'
      ? { title: slot.title, updated: '', blocks: [] }
      : slot.template === 'panel-promo'
        ? (config.value as any)?.dashboardPromo
        : { enabled: false, text: '', tone: 'info', startsAt: '', endsAt: '' }
    const doc = await $fetch<{ id: string }>('/api/admin/website/documents', {
      method: 'POST',
      body: { template: slot.template, key: slot.key, title: slot.title, content },
    })
    await navigateTo(`/admin/website/pages/${doc.id}`)
  }
  catch (e) {
    toaster.add({ title: 'Not created', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    creating.value = null
  }
}

const creditOpen = computed(() => (config.value as any)?.features?.creditApplications !== false)
const switching = ref(false)
async function setCredit(open: boolean) {
  switching.value = true
  try {
    await $fetch('/api/admin/website/panel-features', { method: 'PUT', body: { creditApplications: open } })
    await refreshConfig()
    toaster.add({ title: open ? 'Credit applications open' : 'Credit applications closed', description: open ? 'Customers can apply from their wallet again.' : 'The apply buttons are hidden and a direct request is refused.', icon: 'lucide:check', progress: true })
  }
  catch (e) {
    toaster.add({ title: 'Not changed', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    switching.value = false
  }
}

function fmtDate(iso: string | Date | null) {
  return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

const CARD = 'border-muted-200 bg-white dark:border-muted-800 dark:bg-muted-900 rounded-2xl border'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-8 pb-10">
    <AdminPageHeader
      title="Panel content"
      subtitle="The documents customers read inside this panel: legal pages, the dashboard promo and the announcement bar."
    />

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="Panel content is part of the website module."
    />

    <AdminWebsiteLoadError v-else-if="error" :error="error" title="Could not load the panel documents" @retry="refresh()" />

    <template v-else>
      <div :class="CARD" class="divide-muted-200 flex flex-col divide-y dark:divide-white/5">
        <div v-for="row in rows" :key="row.key" class="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center">
          <div class="min-w-0 flex-1">
            <p class="text-muted-900 text-sm font-semibold dark:text-white">
              {{ row.title }}
            </p>
            <p class="text-muted-500 text-[12.5px]">
              {{ row.detail }}
            </p>
            <p v-if="row.doc" class="text-muted-500 mt-1 text-xs">
              Last edited {{ fmtDate(row.doc.draftUpdatedAt) }}<template v-if="row.doc.publishedAt">
                · published {{ fmtDate(row.doc.publishedAt) }}
              </template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <template v-if="row.doc">
              <AdminWebsiteStatusChip :state="row.doc.state as DisplayStatus" :error="row.doc.lastPublishError" />
              <BaseButton size="sm" rounded="lg" variant="muted" :to="`/admin/website/pages/${row.doc.id}`">
                {{ can('website.edit') ? 'Edit' : 'View' }}
              </BaseButton>
            </template>
            <template v-else-if="!pending">
              <span class="text-muted-500 text-[12.5px]">Not created yet</span>
              <BaseButton v-if="can('website.edit')" size="sm" rounded="lg" variant="primary" :loading="creating === row.key" :disabled="creating !== null" @click="create(row)">
                Create draft
              </BaseButton>
            </template>
          </div>
        </div>
      </div>

      <section :class="CARD" class="flex flex-col gap-3 p-6 sm:flex-row sm:items-center">
        <div class="min-w-0 flex-1">
          <p class="text-muted-900 text-sm font-semibold dark:text-white">
            Credit applications
          </p>
          <p class="text-muted-500 text-[12.5px]">
            Whether customers can apply for a credit line from their wallet. Off hides the apply buttons and refuses a direct request; lines already in place are unaffected.
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <AdminStatusChip :status="creditOpen ? 'open' : 'closed'" :tone="creditOpen ? 'green' : 'muted'" :label="creditOpen ? 'Open' : 'Closed'" />
          <BaseButton v-if="can('website.settings')" size="sm" rounded="lg" variant="muted" :loading="switching" :disabled="switching" @click="setCredit(!creditOpen)">
            {{ creditOpen ? 'Close applications' : 'Open applications' }}
          </BaseButton>
          <span v-else class="text-muted-500 text-[12.5px]">Owner or Admin changes this.</span>
        </div>
      </section>
    </template>
  </div>
</template>
