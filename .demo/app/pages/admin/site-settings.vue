<script setup lang="ts">
import { ADMIN_INPUT } from '~/utils/adminUi'

/**
 * System › Site settings (`Admin Console.dc.html` `v_50settings`, ADR-026),
 * Owner only: the company facts the public site prints, its social
 * profiles, the default social image and maintenance mode.
 *
 * An empty field keeps what the site's code says, and the site never
 * prints a placeholder, so leaving a number blank hides it rather than
 * inventing one. Real or absent: the design's cookie switches and
 * analytics provider are stated, not switched. The site sets no optional
 * cookie and loads no analytics script, so there is no banner to show and
 * no provider to connect.
 */
definePageMeta({
  title: 'Site settings',
  layout: 'admin',
  middleware: 'admin',
})

type Values = Record<string, any>
const toaster = useNuiToasts()
const { ask } = useAdminConfirm()

const { data, error, refresh } = await useFetch<{ values: Values, editable: Record<string, boolean>, images: { id: string, name: string, src: string, alt: string }[] }>('/api/admin/website/settings', { key: 'website-settings' })
const form = ref<Values>({})
const saved = ref('')
watch(data, (d) => {
  if (d) {
    form.value = JSON.parse(JSON.stringify(d.values))
    saved.value = JSON.stringify(form.value)
  }
}, { immediate: true })
const dirty = computed(() => Boolean(data.value) && JSON.stringify(form.value) !== saved.value)
const fieldErrors = ref<Record<string, string[]>>({})

interface Field { key: string, label: string, hint?: string, placeholder?: string, narrow?: boolean, type?: string }
const GROUPS: { title: string, note: string, fields: Field[] }[] = [
  {
    title: 'Company & legal',
    note: 'Printed in the website footer, on About and in the site\'s structured data. Empty keeps what the site\'s code says.',
    fields: [
      { key: 'site.legalName', label: 'Registered name' },
      { key: 'site.name', label: 'Trading name' },
      { key: 'site.companyNumber', label: 'Company number', placeholder: '8 characters, e.g. 12345678', narrow: true },
      { key: 'site.vatNumber', label: 'VAT number', placeholder: 'GB 123 4567 89', narrow: true, hint: 'Leave blank if not VAT registered.' },
      { key: 'site.icoNumber', label: 'ICO registration', placeholder: 'ZA123456', narrow: true },
      { key: 'site.email', label: 'Contact email', type: 'email' },
      { key: 'site.phone', label: 'Phone', placeholder: 'Not provided', narrow: true, type: 'tel', hint: 'Shown only when filled in.' },
    ],
  },
  {
    title: 'Registered office',
    note: 'The street and postcode appear, with a directions link, only once both are filled in.',
    fields: [
      { key: 'site.address.street', label: 'Street' },
      { key: 'site.address.locality', label: 'Town', narrow: true },
      { key: 'site.address.region', label: 'County', narrow: true },
      { key: 'site.address.postcode', label: 'Postcode', narrow: true },
    ],
  },
  {
    title: 'Social profiles',
    note: 'Full https:// addresses. A profile left empty is left out of the footer and the structured data.',
    fields: [
      { key: 'site.social.linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/…' },
      { key: 'site.social.instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/…' },
      { key: 'site.social.x', label: 'X', placeholder: 'https://x.com/…' },
      { key: 'site.social.youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@…' },
    ],
  },
]

const ogImage = computed(() => data.value?.images.find(i => i.id === form.value['site.seo.ogImage']) ?? null)

async function toggleMaintenance() {
  if (!form.value['site.maintenance']) {
    const go = await ask({
      title: 'Turn on maintenance mode?',
      body: 'Once saved, every page on apexdigi.co.uk shows a holding page with your contact email until you turn it off. The contact form stops accepting enquiries.',
      points: [{ tone: 'success', text: 'The client portal and this console stay available.' }],
      confirmLabel: 'Turn on',
      danger: true,
    })
    if (go === null) {
      return
    }
  }
  form.value['site.maintenance'] = !form.value['site.maintenance']
}

const busy = ref(false)
async function save() {
  const before = JSON.parse(saved.value) as Values
  const changed = Object.fromEntries(Object.entries(form.value).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]) && data.value?.editable[k]))
  busy.value = true
  fieldErrors.value = {}
  try {
    await $fetch('/api/admin/website/settings', { method: 'PUT', body: changed })
    await refresh()
    toaster.add({ title: 'Settings saved', description: 'The site shows them on its next page load.', icon: 'lucide:check', progress: true })
  }
  catch (err: any) {
    fieldErrors.value = err?.data?.data?.fieldErrors ?? {}
    toaster.add({ title: 'Not saved', description: Object.keys(fieldErrors.value).length ? 'Some fields need another look. They are marked.' : errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}
function discard() {
  form.value = JSON.parse(saved.value)
  fieldErrors.value = {}
}

const ROW = 'border-line-soft flex flex-col gap-1.5 border-t pt-3.5 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:gap-4'
const LABEL = 'text-fg-heading text-[13.5px] font-semibold sm:w-[170px] sm:shrink-0 sm:pt-2.5'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Site" accent="settings" subtitle="Company details, sharing and availability for apexdigi.co.uk. Owner only." />

    <AdminLoadError v-if="error" :error="error" title="Could not load the site settings" @retry="refresh" />
    <template v-else-if="data">
      <div class="grid items-start gap-5 xl:grid-cols-2">
        <AdminCard v-for="g in GROUPS" :key="g.title" :label="g.title" padded>
          <p class="text-fg-muted -mt-1 text-[12.5px]">
            {{ g.note }}
          </p>
          <div v-for="f in g.fields" :key="f.key" :class="ROW">
            <label :for="f.key" :class="LABEL">{{ f.label }}</label>
            <span class="flex min-w-0 flex-1 flex-col">
              <input
                :id="f.key" v-model="form[f.key]" :type="f.type ?? 'text'" :placeholder="f.placeholder" :readonly="!data.editable[f.key]" :class="ADMIN_INPUT"
                :style="f.narrow ? 'max-width: 260px' : undefined" :aria-invalid="Boolean(fieldErrors[f.key]) || undefined" :aria-describedby="`${f.key}-h`"
                autocomplete="off"
              >
              <span v-if="fieldErrors[f.key]" :id="`${f.key}-h`" class="text-st-danger-fg mt-1.5 text-xs" role="alert">{{ fieldErrors[f.key]![0] }}</span>
              <span v-else-if="f.key === 'site.companyNumber' && !form[f.key]" :id="`${f.key}-h`" class="text-st-warning-fg mt-1.5 text-xs">Not provided. UK company websites must show it.</span>
              <span v-else-if="f.hint" :id="`${f.key}-h`" class="text-fg-muted mt-1.5 text-xs">{{ f.hint }}</span>
            </span>
          </div>
        </AdminCard>

        <AdminCard label="Search & sharing" padded>
          <p class="text-fg-muted -mt-1 text-[12.5px]">
            Defaults for pages without their own settings.
          </p>
          <div :class="ROW">
            <label for="site.seo.ogImage" :class="LABEL">Default social image</label>
            <span class="flex min-w-0 flex-1 flex-col gap-2">
              <select id="site.seo.ogImage" :class="ADMIN_INPUT" :disabled="!data.editable['site.seo.ogImage']" @change="form['site.seo.ogImage'] = ($event.target as HTMLSelectElement).value">
                <option value="" :selected="!form['site.seo.ogImage']">
                  The site's own card
                </option>
                <option v-for="img in data.images" :key="img.id" :value="img.id" :selected="form['site.seo.ogImage'] === img.id">
                  {{ img.name }}
                </option>
              </select>
              <img v-if="ogImage" :src="ogImage.src" :alt="ogImage.alt" class="border-line-subtle aspect-[1200/630] w-full max-w-[320px] rounded-lg border object-cover">
              <span class="text-fg-muted text-xs">Shown when a link is shared and the page has no image of its own. 1200 × 630 works best.</span>
              <span v-if="fieldErrors['site.seo.ogImage']" class="text-st-danger-fg text-xs" role="alert">{{ fieldErrors['site.seo.ogImage'][0] }}</span>
            </span>
          </div>
        </AdminCard>

        <AdminCard label="Cookies & privacy" padded>
          <div :class="ROW">
            <span :class="LABEL">Cookie banner</span>
            <span class="text-fg-body flex-1 text-[13.5px] sm:pt-2.5">Not shown. The site sets no analytics or marketing cookies, so there is nothing to ask consent for.</span>
          </div>
          <div :class="ROW">
            <span :class="LABEL">Analytics</span>
            <span class="text-fg-body flex-1 text-[13.5px] sm:pt-2.5">No provider and no tracking script. Visits are to be counted by the site itself, without cookies or stored IP addresses, and shown in Analytics.</span>
          </div>
        </AdminCard>

        <AdminCard label="Availability" padded>
          <div class="flex items-center gap-3">
            <span class="flex-1">
              <span id="maint-l" class="text-fg-heading block text-[13.5px] font-semibold">Maintenance mode</span>
              <span class="text-fg-muted mt-0.5 block text-xs">{{ form['site.maintenance'] ? 'On · visitors see a holding page' : 'Off · the site is live' }}. The client portal and this console stay available.</span>
            </span>
            <button
              type="button" role="switch" :aria-checked="form['site.maintenance'] === true" aria-labelledby="maint-l" :disabled="!data.editable['site.maintenance']"
              class="apex-ring relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors disabled:opacity-60"
              :class="form['site.maintenance'] ? 'bg-danger-strong' : 'bg-line-strong'"
              @click="toggleMaintenance"
            >
              <span class="absolute top-[3px] size-5 rounded-full bg-white shadow transition-[left]" :class="form['site.maintenance'] ? 'left-[21px]' : 'left-[3px]'" />
            </button>
          </div>
        </AdminCard>
      </div>

      <div v-if="dirty" class="bg-card border-line-subtle shadow-panel sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5" role="status">
        <span class="text-fg-heading flex-1 text-[13.5px] font-semibold">Unsaved changes to site settings</span>
        <AdminButton :disabled="busy" @click="discard">
          Discard
        </AdminButton>
        <AdminButton variant="primary" :disabled="busy" @click="save">
          Save settings
        </AdminButton>
      </div>
    </template>
  </AdminPage>
</template>
