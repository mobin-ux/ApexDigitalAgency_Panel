<script setup lang="ts">
/**
 * Admin — Settings. Platform-wide configuration stored in the Setting
 * model (key/value rows, JSON-encoded, audited on change). The form is
 * driven by a typed catalogue below so the page renders complete even
 * on an empty table; saving upserts only the visible keys.
 *
 * Honesty note (surfaced in the UI too): values are persisted and
 * audited, but each one only takes effect where a feature reads it —
 * wiring is per-feature work, tracked in REQUIREMENTS §6.
 */
definePageMeta({
  title: 'Settings',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()

interface SettingDef {
  key: string
  label: string
  hint?: string
  type: 'text' | 'number' | 'boolean' | 'select'
  options?: { value: string, label: string }[]
  default: string | number | boolean
}

interface SettingGroup {
  group: string
  title: string
  icon: string
  accent: string
  items: SettingDef[]
}

const catalogue: SettingGroup[] = [
  {
    group: 'general',
    title: 'General',
    icon: 'lucide:globe',
    accent: 'bg-primary-500',
    items: [
      { key: 'general.site-name', label: 'Platform name', type: 'text', default: 'Apex Digi Dashboard' },
      { key: 'general.support-email', label: 'Support email', hint: 'Shown to customers on error states and the Support page.', type: 'text', default: 'support@apexdigi.co.uk' },
      { key: 'general.maintenance-mode', label: 'Maintenance mode', hint: 'Shows a maintenance banner on every customer page.', type: 'boolean', default: false },
      { key: 'general.default-locale', label: 'Default language', type: 'select', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }, { value: 'es', label: 'Español' }, { value: 'de', label: 'Deutsch' }, { value: 'ar', label: 'العربية' }, { value: 'ja', label: '日本語' }], default: 'en' },
    ],
  },
  {
    group: 'business',
    title: 'Business',
    icon: 'lucide:building-2',
    accent: 'bg-[#6EA8FE]',
    items: [
      { key: 'business.company-name', label: 'Legal company name', type: 'text', default: 'Apex Digital Agency Ltd' },
      { key: 'business.company-address', label: 'Registered address', type: 'text', default: 'London, United Kingdom' },
      { key: 'business.vat-number', label: 'VAT number', type: 'text', default: '' },
      { key: 'business.vat-rate', label: 'VAT rate (%)', hint: 'Applied when invoicing ships (no invoice model yet).', type: 'number', default: 20 },
    ],
  },
  {
    group: 'finance',
    title: 'Finance',
    icon: 'lucide:wallet',
    accent: 'bg-[#22B07D]',
    items: [
      { key: 'finance.withdrawal-min', label: 'Minimum withdrawal (£)', type: 'number', default: 25 },
      { key: 'finance.withdrawal-max', label: 'Maximum withdrawal (£)', type: 'number', default: 10000 },
      { key: 'finance.enable-24mo-plans', label: '24-month financing', hint: 'Live: gates the 1%/month option in the New Order wizard and the orders API.', type: 'boolean', default: true },
      { key: 'finance.first-installment-days', label: 'First instalment after (days)', hint: 'Live: sets the first due date on every new financing plan.', type: 'number', default: 30 },
    ],
  },
  {
    group: 'payments',
    title: 'Payments',
    icon: 'lucide:credit-card',
    accent: 'bg-[#6EA8FE]',
    items: [
      {
        key: 'payments.live-mode',
        label: 'Live mode',
        hint: 'Live: OFF forces sandbox. Even with live API keys installed, real money only moves when this is on.',
        type: 'boolean',
        default: false,
      },
      {
        key: 'payments.provider.charge',
        label: 'Card & wallet payments',
        hint: 'Live: routes one-off charges (wallet top-ups). Falls back to the mock rail when the provider has no credentials.',
        type: 'select',
        options: [{ value: 'stripe', label: 'Stripe' }, { value: 'paypal', label: 'PayPal' }, { value: 'mock', label: 'Mock (no real money)' }],
        default: 'stripe',
      },
      {
        key: 'payments.provider.recurring',
        label: 'Instalment collection',
        hint: 'Live: routes scheduled instalment collection. Bacs via GoCardless caps fees at £4 per collection.',
        type: 'select',
        options: [{ value: 'gocardless', label: 'GoCardless (Bacs Direct Debit)' }, { value: 'stripe', label: 'Stripe' }, { value: 'mock', label: 'Mock (no real money)' }],
        default: 'gocardless',
      },
      {
        key: 'payments.provider.mandate',
        label: 'Direct debit mandates',
        hint: 'Live: which provider hosts the mandate authorisation flow.',
        type: 'select',
        options: [{ value: 'gocardless', label: 'GoCardless' }, { value: 'stripe', label: 'Stripe' }, { value: 'mock', label: 'Mock' }],
        default: 'gocardless',
      },
      {
        key: 'payments.provider.payout',
        label: 'Withdrawals & payouts',
        hint: 'Live: routes money leaving the platform to customers.',
        type: 'select',
        options: [{ value: 'stripe', label: 'Stripe' }, { value: 'gocardless', label: 'GoCardless' }, { value: 'mock', label: 'Mock' }],
        default: 'stripe',
      },
    ],
  },
  {
    group: 'support',
    title: 'Support',
    icon: 'lucide:life-buoy',
    accent: 'bg-[#F2C14E]',
    items: [
      { key: 'support.default-priority', label: 'Default ticket priority', hint: 'Live: applied when a new request doesn\'t specify one.', type: 'select', options: [{ value: 'LOW', label: 'Low' }, { value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'High' }], default: 'NORMAL' },
      { key: 'support.auto-close-days', label: 'Auto-close resolved after (days)', hint: '0 disables auto-closing.', type: 'number', default: 7 },
      { key: 'support.satisfaction-survey', label: 'Satisfaction survey', hint: 'Ask customers to rate resolved tickets.', type: 'boolean', default: false },
    ],
  },
  {
    group: 'integrations',
    title: 'Integrations',
    icon: 'lucide:plug-zap',
    accent: 'bg-[#EC6453]',
    items: [
      { key: 'integrations.webhook-url', label: 'Outbound webhook URL', hint: 'Receives platform events once an event bus exists.', type: 'text', default: '' },
      { key: 'integrations.slack-webhook', label: 'Slack webhook', hint: 'For new-ticket and new-order alerts.', type: 'text', default: '' },
      { key: 'integrations.analytics-id', label: 'Analytics measurement ID', type: 'text', default: '' },
    ],
  },
]

// Working copy of every setting value, keyed by setting key.
const values = reactive<Record<string, string | number | boolean>>({})
for (const group of catalogue) {
  for (const item of group.items) {
    values[item.key] = item.default
  }
}

const { data } = await useFetch('/api/admin/settings')

// Overlay stored values onto the catalogue defaults.
watch(data, (payload) => {
  for (const row of payload?.settings ?? []) {
    if (row.key in values) {
      values[row.key] = row.value as string | number | boolean
    }
  }
}, { immediate: true })

const lastSaved = computed(() => {
  const rows = data.value?.settings ?? []
  if (!rows.length)
    return null
  const latest = rows.reduce((a, b) => (new Date(a.updatedAt) > new Date(b.updatedAt) ? a : b))
  return latest
})

const saving = ref(false)

async function saveAll() {
  if (saving.value)
    return
  saving.value = true
  try {
    const settings = catalogue.flatMap(group =>
      group.items.map(item => ({
        key: item.key,
        value: item.type === 'number' ? Number(values[item.key]) || 0 : values[item.key],
        group: group.group,
      })),
    )
    const result = await $fetch('/api/admin/settings', { method: 'PUT', body: { settings } })
    toaster.add({
      title: 'Settings saved',
      description: result.updated > 0 ? `${result.updated} value(s) changed and audited.` : 'No values changed.',
      icon: 'lucide:check',
      progress: true,
    })
  }
  catch (error: any) {
    toaster.add({ title: 'Save failed', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    saving.value = false
  }
}

const inputClass = 'w-full rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3 sm:py-2.5 text-sm text-white outline-none placeholder:text-muted-500 focus:border-primary-400'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <AdminPageHeader
      eyebrow="ADMIN · SETTINGS"
      title="Platform settings"
      subtitle="Application-wide configuration. Every change is versioned in the audit trail."
    >
      <BaseButton rounded="full" variant="primary" size="lg" :loading="saving" :disabled="saving" @click="saveAll">
        <Icon name="lucide:save" class="size-4" />
        <span>Save all changes</span>
      </BaseButton>
    </AdminPageHeader>

    <div class="flex items-start gap-3 rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-3 text-[13px] leading-[1.5] text-muted-400">
      <Icon name="lucide:info" class="mt-0.5 size-4 shrink-0 text-[#6EA8FE]" />
      <span>
        Values are stored, audited and served to customers through <span class="text-white">/api/config</span>. Live today: maintenance banner, 24-month plan gate, first-instalment days, default ticket priority, support ETA/FAQ, bank-transfer details and catalogue pricing. Webhooks fire once the event bus ships.
        <template v-if="lastSaved"> Last change: <span class="text-white">{{ lastSaved.key }}</span> by {{ lastSaved.updatedBy || 'unknown' }}.</template>
      </span>
    </div>

    <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <section
        v-for="group in catalogue" :key="group.group"
        class="rounded-[20px] border border-white/10 bg-muted-800 p-6"
        :aria-label="group.title"
      >
        <h2 class="mb-5 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
          <span class="h-[18px] w-1.5 rounded-full" :class="group.accent" />{{ group.title }}
        </h2>

        <div class="flex flex-col gap-4">
          <div v-for="item in group.items" :key="item.key">
            <!-- boolean -> switch row -->
            <div v-if="item.type === 'boolean'" class="flex items-center justify-between gap-4 rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-3">
              <div class="min-w-0">
                <div class="text-[13.5px] font-semibold text-white">
                  {{ item.label }}
                </div>
                <div v-if="item.hint" class="mt-0.5 text-xs leading-[1.45] text-muted-500">
                  {{ item.hint }}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="Boolean(values[item.key])"
                :aria-label="item.label"
                class="apex-tap relative h-6 w-11 shrink-0 rounded-full transition"
                :class="values[item.key] ? 'bg-[#22B07D]' : 'bg-white/10'"
                @click="values[item.key] = !values[item.key]"
              >
                <span class="absolute top-0.5 size-5 rounded-full bg-white shadow transition-all" :class="values[item.key] ? 'left-[22px]' : 'left-0.5'" />
              </button>
            </div>

            <!-- text / number / select -->
            <template v-else>
              <label :for="`setting-${item.key}`" class="mb-2 block text-[12.5px] font-semibold text-white">
                {{ item.label }}
              </label>
              <select
                v-if="item.type === 'select'"
                :id="`setting-${item.key}`"
                v-model="values[item.key]"
                class="w-full cursor-pointer rounded-[11px] border border-white/8 bg-muted-700 px-3.5 py-2.5 text-sm text-white outline-none focus:border-primary-400"
              >
                <option v-for="opt in item.options" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <input
                v-else
                :id="`setting-${item.key}`"
                v-model="values[item.key]"
                :type="item.type === 'number' ? 'number' : 'text'"
                :class="inputClass"
              >
              <p v-if="item.hint" class="mt-1.5 text-xs leading-[1.45] text-muted-500">
                {{ item.hint }}
              </p>
            </template>
          </div>
        </div>
      </section>

      <!-- currency is locked by decision, shown for completeness -->
      <section class="rounded-[20px] border border-white/10 bg-muted-800 p-6" aria-label="Currency">
        <h2 class="mb-4 flex items-center gap-2.5 font-heading text-[15px] font-bold uppercase tracking-[0.04em] text-muted-500">
          <span class="h-[18px] w-1.5 rounded-full bg-primary-200" />Currency
        </h2>
        <div class="flex items-center gap-4 rounded-[11px] border border-white/8 bg-muted-700 px-4 py-3.5">
          <span class="flex size-10 items-center justify-center rounded-[11px] bg-primary-500/14 font-heading text-lg font-extrabold text-primary-400">£</span>
          <div>
            <div class="text-[13.5px] font-semibold text-white">
              GBP — British Pound
            </div>
            <div class="mt-0.5 text-xs text-muted-500">
              Fixed platform-wide (ADR-005). All amounts format through useCurrency().
            </div>
          </div>
          <Icon name="lucide:lock" class="ms-auto size-4 shrink-0 text-muted-500" />
        </div>
      </section>
    </div>
  </div>
</template>
