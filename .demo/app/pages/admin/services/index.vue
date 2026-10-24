<script setup lang="ts">
import type { Catalog, CatalogPlan, CatalogService } from '~~/shared/catalog'
import { orderTerms, paymentCount } from '~~/shared/catalog'

/**
 * Admin — Catalogue (Panel v2, ADR-019). Edits the prices and copy of the
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
  title: 'Catalogue',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can } = useStaffAccess()
const canEdit = computed(() => can('catalogue.edit'))
const { formatCurrency } = useCurrency()

const { data, refresh } = await useFetch<{ catalog: Catalog, defaults: Catalog }>('/api/admin/services')
const state = ref<Catalog>({ version: 2, services: [] })
watch(data, (d) => {
  if (d) {
    state.value = JSON.parse(JSON.stringify(d.catalog))
  }
}, { immediate: true })
const dirty = computed(() => JSON.stringify(state.value) !== JSON.stringify(data.value?.catalog))

const KIND_LABEL = { fixed: 'Deposit + monthly', retainer: 'Retainer', scope: 'Scoped' }

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
    return `${formatCurrency(t.deposit)} + ${paymentCount(s, p)} × ${formatCurrency(t.monthly)} = ${formatCurrency(t.total)}`
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

const inputClass = 'w-full rounded-xl border border-muted-200 bg-muted-50 px-3 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 focus:border-primary-400 disabled:opacity-60 dark:border-white/8 dark:bg-muted-700 dark:text-white dark:placeholder:text-muted-500'
const labelClass = 'mb-1.5 block text-[12px] font-semibold text-muted-900 dark:text-white'
const CARD = 'rounded-2xl border border-muted-200 bg-white p-[18px] dark:border-white/10 dark:bg-muted-800'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-24 font-sans">
    <ApexPageHeader title="Catalogue" accent="" subtitle="The plans customers order from. Prices include VAT; a change applies to the next order signed, never to one already signed." />

    <p v-if="!canEdit" class="rounded-xl bg-[#D9A521]/14 px-4 py-3 text-[13px] text-muted-900 dark:text-[#F2C14E]">
      Your role can view the catalogue but not change it. Editing is limited to the Owner and Admin roles.
    </p>

    <section v-for="s in state.services" :key="s.id" :class="CARD" :aria-label="s.name">
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <span class="font-heading text-[17px] font-bold text-muted-900 dark:text-white">{{ s.name }}</span>
        <span class="rounded-full bg-muted-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.05em] text-muted-600 dark:bg-white/5 dark:text-muted-400">{{ KIND_LABEL[s.kind] }}</span>
        <span class="text-[12px] text-muted-500">/{{ s.slug }}</span>
      </div>
      <div class="grid gap-3 md:grid-cols-2">
        <div>
          <label :for="`${s.id}-name`" :class="labelClass">Name</label>
          <input :id="`${s.id}-name`" v-model="s.name" :disabled="!canEdit" :class="inputClass">
        </div>
        <div>
          <label :for="`${s.id}-line`" :class="labelClass">One line</label>
          <input :id="`${s.id}-line`" v-model="s.line" :disabled="!canEdit" :class="inputClass">
        </div>
        <div>
          <label :for="`${s.id}-heading`" :class="labelClass">Plan heading</label>
          <input :id="`${s.id}-heading`" v-model="s.heading" :disabled="!canEdit" :class="inputClass">
        </div>
        <div v-if="s.kind === 'fixed'">
          <label :for="`${s.id}-payments`" :class="labelClass">Monthly payments after the deposit</label>
          <input :id="`${s.id}-payments`" v-model.number="s.payments" type="number" min="1" max="36" :disabled="!canEdit" :class="inputClass">
        </div>
        <div v-else-if="s.kind === 'retainer'">
          <label :for="`${s.id}-min`" :class="labelClass">Minimum term (months)</label>
          <input :id="`${s.id}-min`" v-model.number="s.minimumMonths" type="number" min="1" max="24" :disabled="!canEdit" :class="inputClass">
        </div>
        <div class="md:col-span-2">
          <label :for="`${s.id}-sub`" :class="labelClass">Under the heading</label>
          <input :id="`${s.id}-sub`" v-model="s.sub" :disabled="!canEdit" :class="inputClass">
        </div>
        <div class="md:col-span-2">
          <label :for="`${s.id}-foot`" :class="labelClass">Small print under the plans</label>
          <input :id="`${s.id}-foot`" v-model="s.foot" :disabled="!canEdit" :class="inputClass">
        </div>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-3">
        <div v-for="p in s.plans" :key="p.id" class="flex flex-col gap-2.5 rounded-xl border border-muted-200 bg-muted-50 p-3.5 dark:border-white/8 dark:bg-white/3">
          <div class="flex items-center gap-2">
            <input v-model="p.name" :aria-label="`${s.name} plan name`" :disabled="!canEdit" :class="inputClass" class="font-semibold">
            <button
              type="button"
              :aria-pressed="Boolean(p.featured)"
              :disabled="!canEdit"
              class="apex-focus shrink-0 rounded-lg px-2 py-1.5 text-[11.5px] font-bold"
              :class="p.featured ? 'bg-primary-500 text-white' : 'bg-muted-200 text-muted-600 dark:bg-white/8 dark:text-muted-300'"
              @click="setFeatured(s, p)"
            >
              Featured
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <template v-if="s.kind !== 'scope'">
              <div>
                <label :for="`${s.id}-${p.id}-m`" :class="labelClass">Monthly £</label>
                <input :id="`${s.id}-${p.id}-m`" v-model.number="p.monthly" type="number" min="0" :disabled="!canEdit" :class="inputClass">
              </div>
              <div v-if="s.kind === 'fixed'">
                <label :for="`${s.id}-${p.id}-d`" :class="labelClass">Deposit £</label>
                <input :id="`${s.id}-${p.id}-d`" v-model.number="p.deposit" type="number" min="0" :disabled="!canEdit" :class="inputClass">
              </div>
              <div v-else>
                <label :for="`${s.id}-${p.id}-s`" :class="labelClass">Set-up £</label>
                <input :id="`${s.id}-${p.id}-s`" v-model.number="p.setup" type="number" min="0" :disabled="!canEdit" :class="inputClass">
              </div>
            </template>
            <template v-else>
              <div>
                <label :for="`${s.id}-${p.id}-p`" :class="labelClass">Price £ (0 = free)</label>
                <input :id="`${s.id}-${p.id}-p`" v-model.number="p.price" type="number" min="0" :disabled="!canEdit" :class="inputClass">
              </div>
              <div>
                <label :for="`${s.id}-${p.id}-n`" :class="labelClass">Short note</label>
                <input :id="`${s.id}-${p.id}-n`" v-model="p.note" :disabled="!canEdit" :class="inputClass">
              </div>
            </template>
          </div>
          <label :for="`${s.id}-${p.id}-sum`" class="sr-only">Summary</label>
          <input :id="`${s.id}-${p.id}-sum`" v-model="p.summary" placeholder="Summary" :disabled="!canEdit" :class="inputClass">
          <label :for="`${s.id}-${p.id}-f`" class="sr-only">Features, one per line</label>
          <textarea :id="`${s.id}-${p.id}-f`" :value="featuresText(p)" rows="4" placeholder="Features, one per line" :disabled="!canEdit" :class="inputClass" @input="setFeatures(p, ($event.target as HTMLTextAreaElement).value)" />
          <p class="m-0 text-[12px] font-semibold tabular-nums text-primary-600 dark:text-primary-400">
            {{ preview(s, p) }}
          </p>
        </div>
      </div>
    </section>

    <div v-if="dirty && canEdit" class="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-muted-200 bg-white px-4 py-3 shadow-[0_20px_48px_rgba(0,0,0,.25)] dark:border-white/10 dark:bg-muted-800">
      <span class="grow text-sm font-semibold text-muted-900 dark:text-white">Unsaved catalogue changes</span>
      <BaseButton rounded="lg" @click="discard">
        Discard
      </BaseButton>
      <BaseButton rounded="lg" variant="primary" :loading="saving" :disabled="saving" @click="save">
        Save catalogue
      </BaseButton>
    </div>
  </div>
</template>
