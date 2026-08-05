<script setup lang="ts">
/**
 * Admin — Services manager. Edits the New Order catalogue that customers see:
 * the list of services and, per service, the plans (tier, price, description,
 * features). Also the home-page "from" prices. Saves to the same Setting rows
 * `/api/config` serves, so changes appear on the customer New Order wizard
 * immediately.
 */
definePageMeta({
  title: 'Services',
  layout: 'admin',
  middleware: 'admin',
})

const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

interface Plan { id: string, name: string, base: number, tier: 0 | 1 | 2, popular?: boolean, desc: string, features: string[] }
interface Service { id: string, name: string, desc: string, icon: string, tone: string }

// Curated choices so the visual language stays on-brand (no free-text classes).
const ICON_OPTIONS = [
  { label: 'Code', value: 'lucide:code-2' },
  { label: 'Megaphone', value: 'lucide:megaphone' },
  { label: 'Pen / design', value: 'lucide:pen-tool' },
  { label: 'Target / brand', value: 'lucide:target' },
  { label: 'Monitor', value: 'lucide:monitor' },
  { label: 'Chart', value: 'lucide:bar-chart-3' },
  { label: 'Palette', value: 'lucide:palette' },
  { label: 'Rocket', value: 'lucide:rocket' },
  { label: 'Cart / e-com', value: 'lucide:shopping-cart' },
  { label: 'Mobile', value: 'lucide:smartphone' },
  { label: 'Search / SEO', value: 'lucide:search' },
  { label: 'Layers', value: 'lucide:layers' },
]
const TONE_OPTIONS = [
  { label: 'Violet', value: 'text-primary-400 bg-primary-500/14' },
  { label: 'Coral', value: 'text-[#EC6453] bg-[#EC6453]/14' },
  { label: 'Amber', value: 'text-[#F2C14E] bg-[#D9A521]/14' },
  { label: 'Green', value: 'text-[#22B07D] bg-[#22B07D]/14' },
  { label: 'Blue', value: 'text-[#6EA8FE] bg-[#6EA8FE]/14' },
]
const TIER_OPTIONS = [
  { label: 'Starter', value: 0 },
  { label: 'Growth', value: 1 },
  { label: 'Scale', value: 2 },
]

const state = reactive<{ services: Service[], plans: Record<string, Plan[]>, fromPrices: Record<string, number> }>({
  services: [],
  plans: {},
  fromPrices: {},
})

const snapshot = ref('')
const saving = ref(false)
const loaded = ref(false)

const { data, refresh } = await useFetch('/api/admin/services')

function hydrate() {
  const d: any = data.value
  if (!d)
    return
  state.services = JSON.parse(JSON.stringify(d.services ?? []))
  state.plans = JSON.parse(JSON.stringify(d.plans ?? {}))
  state.fromPrices = JSON.parse(JSON.stringify(d.fromPrices ?? {}))
  snapshot.value = JSON.stringify(state)
  loaded.value = true
}
hydrate()

const isDirty = computed(() => loaded.value && JSON.stringify(state) !== snapshot.value)

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'service'
}

function uniqueId(base: string, taken: Set<string>) {
  let id = base
  let n = 2
  while (taken.has(id)) {
    id = `${base}-${n++}`
  }
  return id
}

// --- Service ops ---
function addService() {
  const taken = new Set(state.services.map(s => s.id))
  const id = uniqueId('service', taken)
  state.services.push({ id, name: 'New service', desc: '', icon: 'lucide:box', tone: TONE_OPTIONS[0].value })
  state.plans[id] = [{ id: `${id}-plan-1`, name: 'Standard', base: 1500, tier: 0, desc: '', features: [] }]
}

function removeService(idx: number) {
  if (state.services.length <= 1) {
    toaster.add({ title: 'At least one service is required', icon: 'lucide:alert-triangle', progress: true })
    return
  }
  const [removed] = state.services.splice(idx, 1)
  if (removed) {
    delete state.plans[removed.id]
  }
}

// --- Plan ops (plansOf is pure — never mutate state during render) ---
function plansOf(serviceId: string): Plan[] {
  return state.plans[serviceId] ?? []
}

function addPlan(serviceId: string) {
  if (!state.plans[serviceId]) {
    state.plans[serviceId] = []
  }
  const list = state.plans[serviceId]
  const taken = new Set(list.map(p => p.id))
  const id = uniqueId(`${serviceId}-plan-${list.length + 1}`, taken)
  list.push({ id, name: 'New plan', base: 1500, tier: (Math.min(list.length, 2) as 0 | 1 | 2), desc: '', features: [] })
}

function removePlan(serviceId: string, idx: number) {
  const list = state.plans[serviceId] ?? []
  if (list.length <= 1) {
    toaster.add({ title: 'Each service needs at least one plan', icon: 'lucide:alert-triangle', progress: true })
    return
  }
  list.splice(idx, 1)
}

function setPopular(serviceId: string, planId: string) {
  for (const p of state.plans[serviceId] ?? []) {
    p.popular = p.id === planId ? !p.popular : false
  }
}

function addFeature(plan: Plan) {
  plan.features.push('')
}
function removeFeature(plan: Plan, i: number) {
  plan.features.splice(i, 1)
}

// --- From prices ---
const fromPriceKeys = computed(() => Object.keys(state.fromPrices))
const newFromKey = ref('')
function addFromPrice() {
  const key = slugify(newFromKey.value)
  if (!newFromKey.value.trim())
    return
  if (state.fromPrices[key] === undefined) {
    state.fromPrices[key] = 0
  }
  newFromKey.value = ''
}
function removeFromPrice(key: string) {
  delete state.fromPrices[key]
}

// --- Save ---
async function save() {
  if (saving.value)
    return
  // Strip empty features before sending.
  for (const list of Object.values(state.plans)) {
    for (const p of list) {
      p.features = p.features.map(f => f.trim()).filter(Boolean)
    }
  }
  saving.value = true
  try {
    const res: any = await $fetch('/api/admin/services', {
      method: 'PUT',
      body: { services: state.services, plans: state.plans, fromPrices: state.fromPrices },
    })
    snapshot.value = JSON.stringify(state)
    toaster.add({ title: 'Catalogue saved', description: `${res.services} services are now live on New Order.`, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (error: any) {
    const fieldErrors = error?.data?.data?.fieldErrors as Record<string, string[]> | undefined
    const first = fieldErrors ? Object.values(fieldErrors)[0]?.[0] : undefined
    toaster.add({ title: 'Could not save', description: first || error?.data?.message || 'Please check the details and try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    saving.value = false
  }
}

function resetChanges() {
  hydrate()
}

const inputClass = 'w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
const labelClass = 'mb-1.5 block text-[12px] font-semibold text-muted-400'
const selectClass = 'w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3 py-2.5 text-[13px] text-white outline-none focus:border-primary-400'
</script>

<template>
  <div class="mx-auto flex max-w-[1100px] flex-col gap-6 pb-24 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · SERVICES"
      title="Services & pricing"
      subtitle="The catalogue customers choose from on New Order. Edit services, plans, prices and features — changes go live immediately."
    >
      <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" :disabled="!isDirty || saving" @click="resetChanges">
        Reset
      </BaseButton>
      <BaseButton rounded="full" variant="primary" :loading="saving" :disabled="!isDirty || saving" @click="save">
        <Icon name="lucide:save" class="size-4" />
        Save changes
      </BaseButton>
    </AdminPageHeader>

    <div v-if="isDirty" class="flex items-center gap-3 rounded-[14px] border border-[#F2C14E]/30 bg-[#D9A521]/10 px-4 py-3 text-[13px] text-[#F2C14E]">
      <Icon name="lucide:alert-circle" class="size-4 shrink-0" />
      You have unsaved changes.
    </div>

    <!-- ============ SERVICES ============ -->
    <div v-for="(service, sIdx) in state.services" :key="service.id" class="rounded-[20px] border border-white/10 bg-muted-800 p-6">
      <!-- Service header -->
      <div class="flex flex-wrap items-start gap-4">
        <span class="flex size-12 shrink-0 items-center justify-center rounded-[14px]" :class="service.tone">
          <Icon :name="service.icon" class="size-6" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label :class="labelClass">Service name</label>
              <input v-model="service.name" :class="inputClass" placeholder="e.g. Web development">
            </div>
            <div>
              <label :class="labelClass">Short description</label>
              <input v-model="service.desc" :class="inputClass" placeholder="Shown under the name">
            </div>
            <div>
              <label :class="labelClass">Icon</label>
              <select v-model="service.icon" :class="selectClass">
                <option v-for="o in ICON_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </div>
            <div>
              <label :class="labelClass">Accent colour</label>
              <select v-model="service.tone" :class="selectClass">
                <option v-for="o in TONE_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </div>
          </div>
          <div class="mt-2 text-[11.5px] text-muted-500">
            ID <span class="font-mono text-muted-400">{{ service.id }}</span>
          </div>
        </div>
        <button
          type="button" aria-label="Remove service"
          class="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[#EC6453]/25 bg-[#EC6453]/10 text-[#EC6453] transition hover:bg-[#EC6453]/20"
          @click="removeService(sIdx)"
        >
          <Icon name="lucide:trash-2" class="size-4" />
        </button>
      </div>

      <!-- Plans -->
      <div class="mt-5 border-t border-white/8 pt-5">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-[12.5px] font-bold uppercase tracking-[0.05em] text-muted-500">
            Plans ({{ plansOf(service.id).length }})
          </h3>
          <button type="button" class="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-300 hover:text-primary-200" @click="addPlan(service.id)">
            <Icon name="lucide:plus" class="size-3.5" /> Add plan
          </button>
        </div>

        <div class="flex flex-col gap-3">
          <div v-for="(plan, pIdx) in plansOf(service.id)" :key="plan.id" class="rounded-[14px] border border-white/8 bg-muted-700/40 p-4">
            <div class="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <div>
                <label :class="labelClass">Plan name</label>
                <input v-model="plan.name" :class="inputClass">
              </div>
              <div>
                <label :class="labelClass">Price (GBP)</label>
                <div class="flex items-center rounded-[11px] border border-white/8 bg-muted-700 px-3 focus-within:border-primary-400">
                  <span class="text-sm font-semibold text-muted-500">£</span>
                  <input v-model.number="plan.base" type="number" min="0" step="50" class="min-w-0 flex-1 border-none bg-transparent px-2 py-2.5 text-sm text-white outline-none tabular-nums">
                </div>
              </div>
              <div>
                <label :class="labelClass">Tier</label>
                <select v-model.number="plan.tier" :class="selectClass">
                  <option v-for="o in TIER_OPTIONS" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </select>
              </div>
              <div class="flex items-end justify-end">
                <button
                  type="button" aria-label="Remove plan"
                  class="flex size-[42px] items-center justify-center rounded-[10px] border border-white/10 bg-muted-700 text-muted-400 transition hover:border-[#EC6453]/40 hover:text-[#EC6453]"
                  @click="removePlan(service.id, pIdx)"
                >
                  <Icon name="lucide:trash-2" class="size-4" />
                </button>
              </div>
            </div>

            <div class="mt-3">
              <label :class="labelClass">Description</label>
              <input v-model="plan.desc" :class="inputClass" placeholder="One line shown on the plan card">
            </div>

            <!-- Features -->
            <div class="mt-3">
              <label :class="labelClass">Features</label>
              <div class="flex flex-col gap-2">
                <div v-for="(_f, fIdx) in plan.features" :key="fIdx" class="flex items-center gap-2">
                  <Icon name="lucide:check" class="size-4 shrink-0 text-[#22B07D]" />
                  <input v-model="plan.features[fIdx]" :class="inputClass" placeholder="e.g. Up to 8 pages">
                  <button type="button" aria-label="Remove feature" class="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-muted-500 transition hover:text-[#EC6453]" @click="removeFeature(plan, fIdx)">
                    <Icon name="lucide:x" class="size-4" />
                  </button>
                </div>
              </div>
              <button type="button" class="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-300 hover:text-primary-200" @click="addFeature(plan)">
                <Icon name="lucide:plus" class="size-3.5" /> Add feature
              </button>
            </div>

            <div class="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
              <label class="flex cursor-pointer items-center gap-2 text-[13px] text-muted-300">
                <input type="checkbox" :checked="!!plan.popular" class="size-4 accent-primary-500" @change="setPopular(service.id, plan.id)">
                Most popular
              </label>
              <span class="text-[12px] text-muted-500">
                From <span class="font-semibold text-white tabular-nums">{{ formatCurrency(Math.round(plan.base / 12)) }}/mo</span> over 12 months
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <button
      type="button"
      class="flex items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/15 bg-white/[0.02] py-5 text-[14px] font-semibold text-muted-300 transition hover:border-primary-400/40 hover:text-white"
      @click="addService"
    >
      <Icon name="lucide:plus" class="size-5" /> Add a service
    </button>

    <!-- ============ FROM PRICES ============ -->
    <div class="rounded-[20px] border border-white/10 bg-muted-800 p-6">
      <h2 class="text-[13px] font-bold uppercase tracking-[0.05em] text-muted-500">
        Home-page “from” prices
      </h2>
      <p class="mt-1 text-[13px] text-muted-500">
        The monthly “from £X” figures shown on the customer dashboard service cards.
      </p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="key in fromPriceKeys" :key="key" class="flex items-center gap-2">
          <span class="w-28 shrink-0 truncate text-[13px] font-semibold capitalize text-white">{{ key }}</span>
          <div class="flex flex-1 items-center rounded-[11px] border border-white/8 bg-muted-700 px-3 focus-within:border-primary-400">
            <span class="text-sm font-semibold text-muted-500">£</span>
            <input v-model.number="state.fromPrices[key]" type="number" min="0" step="10" class="min-w-0 flex-1 border-none bg-transparent px-2 py-2.5 text-sm text-white outline-none tabular-nums">
            <span class="text-[12px] text-muted-500">/mo</span>
          </div>
          <button type="button" aria-label="Remove" class="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-muted-500 transition hover:text-[#EC6453]" @click="removeFromPrice(key)">
            <Icon name="lucide:x" class="size-4" />
          </button>
        </div>
      </div>
      <div class="mt-4 flex items-center gap-2">
        <input v-model="newFromKey" placeholder="New key (e.g. seo)" class="w-48 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2 text-[13px] text-white outline-none placeholder:text-muted-500 focus:border-primary-400" @keydown.enter.prevent="addFromPrice">
        <button type="button" class="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-300 hover:text-primary-200" @click="addFromPrice">
          <Icon name="lucide:plus" class="size-3.5" /> Add price
        </button>
      </div>
    </div>

    <!-- Sticky save bar when dirty -->
    <div v-if="isDirty" class="sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-4 rounded-[16px] border border-primary-500/30 bg-muted-800/95 px-5 py-3.5 shadow-[0_20px_40px_rgba(0,0,0,.4)] backdrop-blur">
      <span class="text-[13px] font-semibold text-white">Unsaved changes to the catalogue</span>
      <div class="flex items-center gap-2.5">
        <BaseButton rounded="full" class="border border-white/10 bg-muted-700 !text-white hover:bg-muted-600" :disabled="saving" @click="resetChanges">
          Discard
        </BaseButton>
        <BaseButton rounded="full" variant="primary" :loading="saving" :disabled="saving" @click="save">
          <Icon name="lucide:save" class="size-4" /> Save
        </BaseButton>
      </div>
    </div>
  </div>
</template>
