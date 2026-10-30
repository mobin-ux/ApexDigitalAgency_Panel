<script setup lang="ts">
/**
 * Website — site settings (ADR-021). The registry on the server
 * (`server/utils/website/settings.ts`) defines every key, its group and
 * its validation; this screen renders that registry, so a setting cannot
 * exist here without a schema behind it. Empty means "not set": the site
 * keeps the value in its code for that field, and its standing rule still
 * hides anything that ends up empty (a phone number, an address line).
 *
 * `website.view` may look; `website.settings` (Owner, Admin) may save.
 */
definePageMeta({
  title: 'Site settings',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const allowed = computed(() => can('website.view'))
const canSave = computed(() => can('website.settings'))

const { data, refresh, error } = await useFetch<{ fields: { key: string, label: string, group: string, hint: string }[], values: Record<string, unknown> }>('/api/admin/website/settings', { immediate: allowed.value })

const values = ref<Record<string, unknown>>({})
const saved = ref('')
const errors = ref<Record<string, string[]>>({})
watch(data, (d) => {
  values.value = structuredClone(toRaw(d?.values ?? {}))
  saved.value = JSON.stringify(values.value)
  errors.value = {}
}, { immediate: true })
const dirty = computed(() => JSON.stringify(values.value) !== saved.value)

const groups = computed(() => {
  const out = new Map<string, { key: string, label: string, hint: string }[]>()
  for (const f of data.value?.fields ?? []) {
    if (f.key === 'site.seo.ogImage' || f.key === 'site.robots.disallow') {
      continue
    }
    out.set(f.group, [...(out.get(f.group) ?? []), f])
  }
  return [...out.entries()]
})

const disallowText = computed({
  get: () => ((values.value['site.robots.disallow'] as string[] | undefined) ?? []).join('\n'),
  set: (text: string) => {
    values.value['site.robots.disallow'] = text.split('\n').map(l => l.trim()).filter(Boolean)
  },
})
const ogImage = computed({
  get: () => (values.value['site.seo.ogImage'] as { mediaId: string, alt: string } | null) ?? null,
  set: (v) => {
    values.value['site.seo.ogImage'] = v
  },
})

const savingNow = ref(false)
async function save() {
  savingNow.value = true
  errors.value = {}
  try {
    const result = await $fetch<{ changed: string[] }>('/api/admin/website/settings', { method: 'PUT', body: values.value })
    toaster.add({ title: result.changed.length ? `${result.changed.length} setting${result.changed.length === 1 ? '' : 's'} saved` : 'Nothing changed', description: result.changed.length ? 'The site reads them on its next request.' : undefined, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (e: any) {
    if (e?.statusCode === 400 && e?.data?.data?.fieldErrors) {
      errors.value = e.data.data.fieldErrors
    }
    toaster.add({ title: 'Not saved', description: errorMessage(e), icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    savingNow.value = false
  }
}
function discard() {
  values.value = JSON.parse(saved.value)
  errors.value = {}
}

// Leaving with unsaved changes asks in the panel's own dialog (no native confirm), as the editor does.
const pendingLeave = ref<string | null>(null)
const leaveConfirmed = ref(false)
const leaveOpen = computed({
  get: () => pendingLeave.value !== null,
  set: (v: boolean) => {
    if (!v) {
      pendingLeave.value = null
    }
  },
})
onBeforeRouteLeave((to) => {
  if (dirty.value && !leaveConfirmed.value) {
    pendingLeave.value = to.fullPath
    return false
  }
})
function leaveAnyway() {
  leaveConfirmed.value = true
  const target = pendingLeave.value
  pendingLeave.value = null
  if (target) {
    navigateTo(target)
  }
}
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault()
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

const CARD = 'bg-card border-line-subtle rounded-2xl border'
const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
const LABEL = 'text-muted-900 mb-1.5 block text-[13.5px] font-semibold dark:text-white'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-8 pb-24">
    <AdminPageHeader
      title="Site" accent="settings"
      subtitle="Company facts, contact details, social profiles and search defaults the public site reads. Empty keeps what the site code says, and the site hides anything that stays empty."
    />

    <AdminAccessWall
      v-if="!allowed"
      permission="website.view"
      title="Website content is not part of your role"
      body="Site settings are part of the website module."
    />

    <AdminWebsiteLoadError v-else-if="error" :error="error" title="Could not load the settings" @retry="refresh()" />

    <form v-else class="flex flex-col gap-6" @submit.prevent="save">
      <fieldset :disabled="!canSave" class="flex flex-col gap-6">
        <section v-for="[group, fields] in groups" :key="group" :class="CARD" class="p-6">
          <ApexSectionLabel>{{ group }}</ApexSectionLabel>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <div v-for="f in fields" :key="f.key" :class="f.key.includes('description') || f.key.includes('tagline') ? 'sm:col-span-2' : ''">
              <label :for="`s-${f.key}`" :class="LABEL">{{ f.label }}</label>
              <input :id="`s-${f.key}`" v-model="(values[f.key] as string)" :class="INPUT" :aria-invalid="errors[f.key] ? 'true' : undefined">
              <p v-if="f.hint" class="text-muted-500 mt-1.5 text-xs">
                {{ f.hint }}
              </p>
              <p v-for="e in errors[f.key] ?? []" :key="e" class="mt-1.5 text-xs font-semibold text-[#EC6453]" role="alert">
                {{ e }}
              </p>
            </div>
          </div>
        </section>

        <section :class="CARD" class="p-6">
          <ApexSectionLabel>Search engines</ApexSectionLabel>
          <div class="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <span :class="LABEL">Default social image</span>
              <AdminWebsiteMediaPicker v-model="ogImage" accept="image" />
              <p class="text-muted-500 mt-1.5 text-xs">
                Used when a page has no social image of its own. 1200 × 630 works everywhere.
              </p>
            </div>
            <div>
              <label for="s-disallow" :class="LABEL">Hide from search engines</label>
              <textarea id="s-disallow" v-model="disallowText" rows="4" :class="INPUT" class="resize-y font-mono" placeholder="/offers/internal" />
              <p class="text-muted-500 mt-1.5 text-xs">
                One path per line, added to robots.txt as Disallow. The site root, /_nuxt and /api/ can never be hidden.
              </p>
              <p v-for="e in errors['site.robots.disallow'] ?? []" :key="e" class="mt-1.5 text-xs font-semibold text-[#EC6453]" role="alert">
                {{ e }}
              </p>
            </div>
          </div>
        </section>
      </fieldset>

      <div v-if="canSave" class="border-muted-200 bg-white/90 dark:border-muted-800 dark:bg-muted-900/90 sticky bottom-0 flex items-center gap-3 border-t py-4 backdrop-blur">
        <AdminButton type="submit" variant="primary" :disabled="savingNow || !dirty">
          {{ dirty ? 'Save settings' : 'Saved' }}
        </AdminButton>
        <AdminButton type="button" :disabled="!dirty" @click="discard">
          Discard
        </AdminButton>
        <span class="text-muted-500 text-[12.5px]">Changes are audited and reach the site within a minute.</span>
      </div>
      <p v-else class="text-muted-500 text-[12.5px]">
        An Owner or Admin changes these.
      </p>
    </form>

    <AdminWebsiteDialog v-model:open="leaveOpen" title="Leave without saving?" description="Your unsaved changes to the site settings will be lost.">
      <template #actions>
        <AdminButton @click="pendingLeave = null">
          Stay
        </AdminButton>
        <AdminButton variant="primary" @click="leaveAnyway">
          Leave
        </AdminButton>
      </template>
    </AdminWebsiteDialog>
  </div>
</template>
