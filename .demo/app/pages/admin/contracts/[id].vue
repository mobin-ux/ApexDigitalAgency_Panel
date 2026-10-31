<script setup lang="ts">
/**
 * Admin — Contract dossier. Full agreement record: terms, e-signature,
 * customer, the linked project (milestones + files) and the live repayment
 * plan, plus lifecycle status management.
 */
definePageMeta({
  title: 'Contract',
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const { formatCurrency } = useCurrency()
const toaster = useNuiToasts()

const { data, pending, error, refresh } = await useFetch(`/api/admin/contracts/${route.params.id}`)
useAdminCrumb(() => (data.value as any)?.contract?.reference ?? null, '/admin/contracts')
const contract = computed<any>(() => data.value?.contract ?? null)
const project = computed<any>(() => contract.value?.project ?? null)
const plan = computed<any>(() => project.value?.installmentPlan ?? null)

const signatureIsImage = computed(() => typeof contract.value?.signature === 'string' && contract.value.signature.startsWith('data:image'))

function fmtDate(iso: string | Date | null) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Full timestamp with time + UTC — the precise moment of signing is part of
// the legal evidence, so show it to the second.
function fmtDateTime(iso: string | Date | null) {
  if (!iso)
    return '—'
  return `${new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })} UTC`
}

const sigTypeLabel = computed(() => {
  const t = contract.value?.signatureType
  if (t === 'drawn')
    return 'Hand-drawn signature'
  if (t === 'typed')
    return 'Typed signature'
  return signatureIsImage.value ? 'Hand-drawn signature' : 'Typed signature'
})

function customerName(u: any) {
  if (!u)
    return '—'
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email || u.phone || '—'
}

// --- Status management ---
const updating = ref(false)
async function setStatus(status: string) {
  if (updating.value || contract.value?.status === status)
    return
  updating.value = true
  try {
    await $fetch(`/api/admin/contracts/${route.params.id}`, { method: 'PATCH', body: { status } })
    toaster.add({ title: 'Contract updated', description: `Status set to ${status.toLowerCase()}.`, icon: 'lucide:check', progress: true })
    await refresh()
  }
  catch (err: any) {
    toaster.add({ title: 'Could not update', description: err?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    updating.value = false
  }
}

const STATUS_ACTIONS = [
  { value: 'ACTIVE', label: 'Active', icon: 'lucide:play' },
  { value: 'COMPLETED', label: 'Completed', icon: 'lucide:check-check' },
  { value: 'CANCELLED', label: 'Cancel', icon: 'lucide:x' },
]

const cardClass = 'rounded-2xl border border-line-subtle bg-card p-6'
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1180px] px-4 pt-5 sm:px-8 sm:pt-7 flex-col gap-6 pb-8 text-fg-body">
    <NuxtLink to="/admin/contracts" class="inline-flex items-center gap-2 text-[13px] font-semibold text-fg-body transition hover:text-fg-heading">
      <Icon name="lucide:arrow-left" class="size-4" /> All contracts
    </NuxtLink>

    <div v-if="pending" class="h-40 animate-pulse rounded-[20px] border border-line-subtle bg-card" />

    <AdminEmptyState
      v-else-if="error || !contract" icon="lucide:file-x" title="Contract not found"
      subtitle="It may have been removed."
    />

    <template v-else>
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div class="mb-2 flex items-center gap-3">
            <span class="font-mono text-[13px] font-bold text-accent-ink">{{ contract.reference }}</span>
            <AdminStatusChip :status="contract.status" />
          </div>
          <h1 class="font-heading text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-fg-heading sm:text-[34px]">
            {{ project?.name }}
          </h1>
          <p class="mt-2 text-[15px] text-fg-body">
            {{ project?.category }} · signed {{ fmtDate(contract.signedAt) }} by {{ customerName(contract.user) }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button
            v-for="a in STATUS_ACTIONS" :key="a.value"
            type="button"
            :disabled="updating || contract.status === a.value"
            class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="a.value === 'CANCELLED'
              ? 'border-[#EC6453]/30 bg-st-danger-bg text-st-danger-fg enabled:hover:bg-st-danger-bg'
              : 'border-line-subtle bg-raised text-fg-heading enabled:hover:bg-hover'"
            @click="setStatus(a.value)"
          >
            <Icon :name="a.icon" class="size-3.5" />
            {{ a.label }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <!-- LEFT: terms + project + plan -->
        <div class="flex flex-col gap-6">
          <!-- Agreement terms -->
          <div :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
              Agreement terms
            </h2>
            <div class="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <div>
                <div class="text-[12px] text-fg-muted">
                  Financed amount
                </div>
                <div class="mt-1 font-heading text-[22px] font-extrabold text-fg-heading tabular-nums">
                  {{ formatCurrency(contract.amount) }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-fg-muted">
                  Repayment term
                </div>
                <div class="mt-1 text-[18px] font-bold text-fg-heading tabular-nums">
                  {{ contract.termMonths }} months
                </div>
              </div>
              <div>
                <div class="text-[12px] text-fg-muted">
                  Interest
                </div>
                <div class="mt-1 text-[18px] font-bold text-fg-heading tabular-nums">
                  {{ contract.interestRate > 0 ? `${(contract.interestRate * 100).toFixed(0)}% / mo` : '0% (interest-free)' }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-fg-muted">
                  Monthly payment
                </div>
                <div class="mt-1 text-[18px] font-bold text-fg-heading tabular-nums">
                  {{ formatCurrency(contract.monthlyAmount) }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-fg-muted">
                  Total repayable
                </div>
                <div class="mt-1 text-[18px] font-bold text-fg-heading tabular-nums">
                  {{ formatCurrency(contract.totalRepayable) }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-fg-muted">
                  Signed
                </div>
                <div class="mt-1 text-[18px] font-bold text-fg-heading">
                  {{ fmtDate(contract.signedAt) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Signed agreement document (the exact text the customer agreed to) -->
          <div v-if="contract.agreementText" :class="cardClass">
            <div class="mb-4 flex items-center justify-between gap-3">
              <h2 class="text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
                Signed agreement
              </h2>
              <span v-if="contract.documentVersion" class="rounded-full bg-chip px-2.5 py-1 font-mono text-[11px] text-fg-body">{{ contract.documentVersion }}</span>
            </div>
            <pre class="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-[12px] border border-line-subtle bg-desk p-4 font-mono text-[12px] leading-[1.6] text-fg-body">{{ contract.agreementText }}</pre>
            <div v-if="contract.documentHash" class="mt-3 flex items-start gap-2 text-[11.5px] text-fg-muted">
              <Icon name="lucide:shield-check" class="mt-0.5 size-3.5 shrink-0 text-st-success-fg" />
              <span>SHA-256 integrity hash — any change to the text above would change this value.<br><span class="break-all font-mono text-fg-body">{{ contract.documentHash }}</span></span>
            </div>
          </div>

          <!-- Repayment plan -->
          <div v-if="plan" :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
              Repayment plan
            </h2>
            <div class="mb-3 flex items-end justify-between">
              <div>
                <div class="text-[13px] text-fg-body">
                  Paid so far
                </div>
                <div class="font-heading text-[22px] font-extrabold text-fg-heading tabular-nums">
                  {{ formatCurrency(plan.paid) }} <span class="text-[14px] font-semibold text-fg-muted">of {{ formatCurrency(plan.total) }}</span>
                </div>
              </div>
              <AdminStatusChip :status="plan.status" />
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-chip">
              <div class="h-full rounded-full bg-[#22B07D]" :style="{ width: `${Math.min(100, Math.round((plan.paid / (plan.total || 1)) * 100))}%` }" />
            </div>
            <div class="mt-3 flex items-center justify-between text-[12.5px] text-fg-muted">
              <span>{{ plan.monthsPaid }} / {{ plan.monthsTotal }} installments</span>
              <span>Next due {{ fmtDate(plan.nextDue) }}</span>
            </div>
          </div>

          <!-- Project details + milestones -->
          <div :class="cardClass">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
                Project
              </h2>
              <NuxtLink :to="`/admin/projects/${project.id}`" class="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-ink hover:text-accent-ink">
                Open project <Icon name="lucide:external-link" class="size-3.5" />
              </NuxtLink>
            </div>
            <div class="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
              <span class="text-fg-body">Status <AdminStatusChip :status="project.status" class="ml-1" /></span>
              <span class="text-fg-body">Progress <span class="font-semibold text-fg-heading">{{ project.progress }}%</span></span>
              <span class="text-fg-body">Deadline <span class="font-semibold text-fg-heading">{{ fmtDate(project.deadline) }}</span></span>
            </div>
            <div v-if="project.milestones?.length" class="flex flex-col gap-2.5">
              <div v-for="m in project.milestones" :key="m.id" class="flex items-center gap-3 text-[13px]">
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full"
                  :class="m.status === 'COMPLETED' ? 'bg-st-success-bg text-st-success-fg' : m.status === 'CURRENT' ? 'bg-st-warning-bg text-st-warning-fg' : 'bg-chip text-fg-muted'"
                >
                  <Icon :name="m.status === 'COMPLETED' ? 'lucide:check' : 'lucide:circle'" class="size-3" />
                </span>
                <span class="text-fg-heading">{{ m.title }}</span>
                <span class="ml-auto text-fg-muted">{{ fmtDate(m.date) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: customer + signature -->
        <div class="flex flex-col gap-6">
          <div :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
              Customer
            </h2>
            <AdminUserCell :user="{ ...contract.user, email: contract.user.email || contract.user.phone || '—' }" />
            <div class="mt-4 flex flex-col gap-2 text-[13px]">
              <div v-if="contract.user.email" class="flex items-center gap-2 text-fg-body">
                <Icon name="lucide:mail" class="size-4 text-fg-muted" /> {{ contract.user.email }}
              </div>
              <div v-if="contract.user.phone" class="flex items-center gap-2 text-fg-body">
                <Icon name="lucide:phone" class="size-4 text-fg-muted" /> {{ contract.user.phone }}
              </div>
              <div class="flex items-center gap-2 text-fg-body">
                <Icon name="lucide:calendar" class="size-4 text-fg-muted" /> Customer since {{ fmtDate(contract.user.createdAt) }}
              </div>
            </div>
            <NuxtLink :to="`/admin/users/${contract.user.id}`" class="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-ink hover:text-accent-ink">
              View customer <Icon name="lucide:arrow-right" class="size-3.5" />
            </NuxtLink>
          </div>

          <div :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
              E-signature
            </h2>
            <div v-if="contract.signature" class="rounded-[14px] border border-line-subtle bg-white p-4">
              <img v-if="signatureIsImage" :src="contract.signature" alt="Customer signature" class="mx-auto max-h-32 w-auto">
              <div v-else class="py-4 text-center font-[cursive] text-[26px] text-muted-950">
                {{ contract.signature }}
              </div>
            </div>
            <div v-else class="rounded-[14px] border border-dashed border-line-subtle bg-chip p-6 text-center text-[13px] text-fg-muted">
              No signature captured
            </div>
            <p class="mt-3 text-[12px] text-fg-muted">
              {{ sigTypeLabel }} · captured {{ fmtDateTime(contract.signedAt) }}.
            </p>
          </div>

          <!-- Legal record / evidence -->
          <div :class="cardClass">
            <h2 class="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.05em] text-fg-muted">
              <Icon name="lucide:scale" class="size-4 text-accent-ink" />Legal record
            </h2>
            <dl class="flex flex-col divide-y divide-white/5 text-[13px]">
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  Signatory
                </dt>
                <dd class="text-right font-semibold text-fg-heading">
                  {{ contract.signerName || customerName(contract.user) }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  Contact at signing
                </dt>
                <dd class="break-all text-right text-fg-heading">
                  {{ contract.signerEmail || contract.signerPhone || '—' }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  Method
                </dt>
                <dd class="text-right text-fg-heading">
                  {{ sigTypeLabel }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  Signed at
                </dt>
                <dd class="text-right text-fg-heading">
                  {{ fmtDateTime(contract.signedAt) }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  IP address
                </dt>
                <dd class="break-all text-right font-mono text-[12px] text-fg-heading">
                  {{ contract.signedIp || '—' }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  Device
                </dt>
                <dd class="break-all text-right text-[11.5px] text-fg-body">
                  {{ contract.signedUserAgent || '—' }}
                </dd>
              </div>
              <div v-if="contract.documentVersion" class="flex items-start justify-between gap-4 py-2.5">
                <dt class="shrink-0 text-fg-muted">
                  Terms version
                </dt>
                <dd class="text-right font-mono text-[12px] text-fg-heading">
                  {{ contract.documentVersion }}
                </dd>
              </div>
            </dl>
            <p class="mt-3 flex items-start gap-2 rounded-[10px] border border-line-subtle bg-chip px-3 py-2.5 text-[11.5px] leading-[1.55] text-fg-body">
              <Icon name="lucide:lock" class="mt-0.5 size-3.5 shrink-0 text-st-success-fg" />
              Electronically signed under the Electronic Communications Act 2000. This record — the agreement text, signature, timestamp, IP and device — is admissible as evidence of the customer's intent to be bound.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
