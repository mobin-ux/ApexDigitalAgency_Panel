<script setup lang="ts">
import type { Catalog, CatalogPlan, CatalogService } from '~~/shared/catalog'
import { orderTerms, paymentCount } from '~~/shared/catalog'
import { ADMIN_INPUT, ADMIN_TEXTAREA, ADMIN_TH } from '~/utils/adminUi'

/**
 * Admin console — Services & pricing (`Admin Console.dc.html`, Panel v2 ADR-019). Edits the prices and copy of the
 * plans customers order from: the same `catalog.v2` Setting the New order
 * wizard renders and `POST /api/orders` prices with, so a change here is the
 * price the next customer signs at.
 *
 * Services, their payment kind and plan ids are fixed — orders and payment
 * rules are keyed on them — so this screen edits figures and words only. Each
 * plan shows the totals `orderTerms()` will produce, so a typo in a deposit is
 * visible before it is saved.
 */
definePageMeta({
  title: 'Services & pricing',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const canEdit = computed(() => can('catalogue.edit'))
const { formatCurrency } = useCurrency()

const { data, refresh } = await useFetch<{ catalog: Catalog, defaults: Catalog, live: Record<string, number> }>('/api/admin/services')
const state = ref<Catalog>({ version: 2, services: [] })
watch(data, (d) => {
  if (d) {
    state.value = JSON.parse(JSON.stringify(d.catalog))
  }
}, { immediate: true })
const dirty = computed(() => JSON.stringify(state.value) !== JSON.stringify(data.value?.catalog))

const KIND_LABEL = { fixed: 'Equal monthly', retainer: 'Retainer', scope: 'Scoped' }

function featuresText(p: CatalogPlan) {
  return p.features.join('\n')
}
function setFeatures(p: CatalogPlan, v: string) {
  p.features = v.split('\n').map(x => x.trim()).filter(Boolean)
}
function setFeatured(s: CatalogService, p: CatalogPlan) {
  for (const x of s.plans) {
    x.featured = x.id === p.id ? !p.featured : false
  }
}
function preview(s: CatalogService, p: CatalogPlan) {
  const t = orderTerms(s, p, 'monthly')
  if (s.kind === 'fixed') {
    return t.deposit > 0
      ? `${formatCurrency(t.deposit)} + ${paymentCount(s, p)} × ${formatCurrency(t.monthly)} = ${formatCurrency(t.total)}`
      : `${paymentCount(s, p)} × ${formatCurrency(t.monthly)} = ${formatCurrency(t.total)}, the first at kickoff`
  }
  if (s.kind === 'retainer') {
    return `${formatCurrency(t.kickoff)} at kickoff · ${s.minimumMonths}-month minimum ${formatCurrency(t.total)}`
  }
  return t.total ? `${formatCurrency(t.total)} when discovery starts` : 'Free'
}

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch('/api/admin/services', { method: 'PUT', body: { services: state.value.services } })
    await refresh()
    toaster.add({ title: 'Catalogue saved', description: 'New orders use these prices from now on.', icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    toaster.add({ title: 'Not saved', description: (fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined) || error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    saving.value = false
  }
}
function discard() {
  if (data.value) {
    state.value = JSON.parse(JSON.stringify(data.value.catalog))
  }
}

/**
 * The design's table row per service: the "from" figure is the cheapest
 * plan's monthly (or price), so it is derived rather than typed — the
 * plans below it are what customers are charged. The design's "Available"
 * switch is not drawn: the catalogue has no retire flag, and the order
 * wizard would keep offering a service the switch claimed to hide.
 */
function fromPrice(svc: CatalogService) {
  const values = svc.plans.map(p => (svc.kind === 'scope' ? p.price ?? 0 : p.monthly ?? 0)).filter(v => v > 0)
  return values.length ? Math.min(...values) : 0
}
function termsOf(svc: CatalogService) {
  if (svc.kind === 'fixed') {
    return `${svc.payments ?? 12} monthly payments`
  }
  if (svc.kind === 'retainer') {
    return `Monthly · ${svc.minimumMonths ?? 6}-month minimum`
  }
  return 'Scoped after discovery'
}
const open = ref<string | null>(null)

const LABEL = 'text-fg-heading mb-1.5 block text-xs font-semibold'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Services &" accent="pricing" subtitle="Prices and terms set here are the only ones the order wizard, Wallet and service pages can show.">
      <template v-if="dirty && canEdit">
        <AdminButton @click="discard">
          Discard
        </AdminButton>
        <AdminButton variant="primary" :disabled="saving" @click="save">
          Save prices
        </AdminButton>
      </template>
    </AdminPageHeader>

    <p v-if="!canEdit" class="bg-chip border-line-subtle text-fg-body rounded-xl border px-4 py-3 text-[13.5px]">
      You can view the catalogue. Changing prices needs Owner or Admin.
    </p>

    <section class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div class="hidden grid-cols-[minmax(0,1fr)_150px_190px_110px_220px_110px] gap-3.5 px-[22px] py-3.5 xl:grid" :class="ADMIN_TH">
        <span>Service</span><span>From, per month</span><span>Terms offered</span><span class="text-end">Live projects</span><span>Website page</span><span class="text-end">Plans</span>
      </div>
      <div v-for="s in state.services" :key="s.id" class="border-line-soft border-t">
        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 px-[18px] py-3 sm:px-[22px] xl:grid-cols-[minmax(0,1fr)_150px_190px_110px_220px_110px]">
          <span class="text-fg-heading min-w-0 truncate text-sm font-semibold">{{ s.name }}</span>
          <span class="text-fg-heading text-sm tabular-nums xl:order-none">
            {{ fromPrice(s) ? `${formatCurrency(fromPrice(s))}${s.kind === 'scope' ? '' : '/mo'}` : 'Free' }}
          </span>
          <span class="text-fg-body text-[13px]">{{ termsOf(s) }}</span>
          <span class="text-fg-heading text-[13.5px] tabular-nums xl:text-end">
            <span class="text-fg-muted xl:hidden">Live projects: </span>{{ data?.live?.[s.id] ?? 0 }}
          </span>
          <span class="min-w-0 truncate text-[13px]">
            <NuxtLink v-if="can('website.view')" :to="`/admin/website/pages?q=${s.slug}`" class="apex-ring text-accent-ink rounded font-medium">/services/{{ s.slug }} →</NuxtLink>
            <span v-else class="text-fg-muted">/services/{{ s.slug }}</span>
          </span>
          <span class="xl:text-end">
            <button type="button" class="apex-ring text-accent-ink inline-flex items-center gap-1 rounded text-[13px] font-semibold" :aria-expanded="open === s.id" :aria-controls="`plans-${s.id}`" @click="open = open === s.id ? null : s.id">
              {{ canEdit ? 'Edit' : 'View' }} {{ s.plans.length }}
              <Icon name="lucide:chevron-down" class="size-3.5 transition-transform" :class="open === s.id && 'rotate-180'" />
            </button>
          </span>
        </div>

        <div v-if="open === s.id" :id="`plans-${s.id}`" class="bg-raised border-line-soft flex flex-col gap-4 border-t px-[18px] py-5 sm:px-[22px]">
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <label :for="`${s.id}-name`" :class="LABEL">Name</label>
              <input :id="`${s.id}-name`" v-model="s.name" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
            <div>
              <label :for="`${s.id}-line`" :class="LABEL">One line</label>
              <input :id="`${s.id}-line`" v-model="s.line" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
            <div>
              <label :for="`${s.id}-heading`" :class="LABEL">Plan heading</label>
              <input :id="`${s.id}-heading`" v-model="s.heading" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
            <div v-if="s.kind === 'fixed'">
              <label :for="`${s.id}-payments`" :class="LABEL">Monthly payments</label>
              <input :id="`${s.id}-payments`" v-model.number="s.payments" type="number" min="1" max="36" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
            <div v-else-if="s.kind === 'retainer'">
              <label :for="`${s.id}-min`" :class="LABEL">Minimum term (months)</label>
              <input :id="`${s.id}-min`" v-model.number="s.minimumMonths" type="number" min="1" max="24" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
            <div class="md:col-span-2">
              <label :for="`${s.id}-sub`" :class="LABEL">Under the heading</label>
              <input :id="`${s.id}-sub`" v-model="s.sub" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
            <div class="md:col-span-2">
              <label :for="`${s.id}-foot`" :class="LABEL">Small print under the plans</label>
              <input :id="`${s.id}-foot`" v-model="s.foot" :disabled="!canEdit" :class="ADMIN_INPUT">
            </div>
          </div>

          <div class="grid gap-3.5 xl:grid-cols-3">
            <div v-for="p in s.plans" :key="p.id" class="bg-card border-line-subtle flex flex-col gap-2.5 rounded-xl border p-3.5">
              <div class="flex items-center gap-2">
                <label :for="`${s.id}-${p.id}-name`" class="sr-only">{{ s.name }} plan name</label>
                <input :id="`${s.id}-${p.id}-name`" v-model="p.name" :disabled="!canEdit" :class="ADMIN_INPUT" class="font-semibold">
                <button
                  type="button"
                  :aria-pressed="Boolean(p.featured)"
                  :disabled="!canEdit"
                  class="apex-ring h-8 shrink-0 rounded-full border px-3 text-xs font-semibold"
                  :class="p.featured ? 'bg-accent border-transparent text-white' : 'border-line-subtle text-fg-heading'"
                  @click="setFeatured(s, p)"
                >
                  Featured
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <template v-if="s.kind !== 'scope'">
                  <div>
                    <label :for="`${s.id}-${p.id}-m`" :class="LABEL">Monthly £</label>
                    <input :id="`${s.id}-${p.id}-m`" v-model.number="p.monthly" type="number" min="0" :disabled="!canEdit" :class="ADMIN_INPUT">
                  </div>
                  <div v-if="s.kind === 'fixed'">
                    <label :for="`${s.id}-${p.id}-d`" :class="LABEL">Deposit £ (optional)</label>
                    <input :id="`${s.id}-${p.id}-d`" v-model.number="p.deposit" type="number" min="0" :disabled="!canEdit" :class="ADMIN_INPUT">
                  </div>
                  <div v-else>
                    <label :for="`${s.id}-${p.id}-s`" :class="LABEL">Set-up £</label>
                    <input :id="`${s.id}-${p.id}-s`" v-model.number="p.setup" type="number" min="0" :disabled="!canEdit" :class="ADMIN_INPUT">
                  </div>
                </template>
                <template v-else>
                  <div>
                    <label :for="`${s.id}-${p.id}-p`" :class="LABEL">Price £ (0 = free)</label>
                    <input :id="`${s.id}-${p.id}-p`" v-model.number="p.price" type="number" min="0" :disabled="!canEdit" :class="ADMIN_INPUT">
                  </div>
                  <div>
                    <label :for="`${s.id}-${p.id}-n`" :class="LABEL">Short note</label>
                    <input :id="`${s.id}-${p.id}-n`" v-model="p.note" :disabled="!canEdit" :class="ADMIN_INPUT">
                  </div>
                </template>
              </div>
              <label :for="`${s.id}-${p.id}-sum`" class="sr-only">Summary</label>
              <input :id="`${s.id}-${p.id}-sum`" v-model="p.summary" placeholder="Summary" :disabled="!canEdit" :class="ADMIN_INPUT">
              <label :for="`${s.id}-${p.id}-f`" class="sr-only">Features, one per line</label>
              <textarea :id="`${s.id}-${p.id}-f`" :value="featuresText(p)" rows="4" placeholder="Features, one per line" :disabled="!canEdit" :class="ADMIN_TEXTAREA" @input="setFeatures(p, ($event.target as HTMLTextAreaElement).value)" />
              <p class="text-accent-ink text-xs font-semibold tabular-nums">
                {{ preview(s, p) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <p class="text-fg-muted text-[12.5px] leading-[1.55]">
      Price changes apply to new orders only. Existing plans keep the price and terms they were agreed at. Figures include VAT.
    </p>

    <!-- The design's unsaved-changes bar: pinned to the bottom of the desk while there is something to save. -->
    <div v-if="dirty && canEdit" class="apex-rise-in border-line-strong bg-card sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-[0_-20px_48px_rgba(17,31,34,.18)]">
      <Icon name="lucide:circle-dot" class="size-4 text-[#D9A521]" />
      <span class="text-fg-heading flex-1 text-sm">Unsaved catalogue changes. New orders keep the old prices until you save.</span>
      <AdminButton @click="discard">
        Discard
      </AdminButton>
      <AdminButton variant="primary" :disabled="saving" @click="save">
        Save changes
      </AdminButton>
    </div>
  </AdminPage>
</template>
