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
const contract = computed<any>(() => data.value?.contract ?? null)
const project = computed<any>(() => contract.value?.project ?? null)
const plan = computed<any>(() => project.value?.installmentPlan ?? null)

const signatureIsImage = computed(() => typeof contract.value?.signature === 'string' && contract.value.signature.startsWith('data:image'))

function fmtDate(iso: string | Date | null) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

const cardClass = 'rounded-[20px] border border-white/10 bg-muted-800 p-6'
</script>

<template>
  <div class="mx-auto flex max-w-[1100px] flex-col gap-6 pb-8 font-sans text-muted-400">
    <NuxtLink to="/admin/contracts" class="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-400 transition hover:text-white">
      <Icon name="lucide:arrow-left" class="size-4" /> All contracts
    </NuxtLink>

    <div v-if="pending" class="h-40 animate-pulse rounded-[20px] border border-white/5 bg-muted-800/60" />

    <AdminEmptyState
      v-else-if="error || !contract" icon="lucide:file-x" title="Contract not found"
      subtitle="It may have been removed."
    />

    <template v-else>
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div class="mb-2 flex items-center gap-3">
            <span class="font-mono text-[13px] font-bold text-primary-300">{{ contract.reference }}</span>
            <AdminStatusChip :status="contract.status" />
          </div>
          <h1 class="font-heading text-[30px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-[34px]">
            {{ project?.name }}
          </h1>
          <p class="mt-2 text-[15px] text-muted-400">
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
              ? 'border-[#EC6453]/30 bg-[#EC6453]/10 text-[#EC6453] enabled:hover:bg-[#EC6453]/20'
              : 'border-white/10 bg-muted-700 text-white enabled:hover:bg-muted-600'"
            @click="setStatus(a.value)"
          >
            <Icon :name="a.icon" class="size-3.5" />
            {{ a.label }}
          </button>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <!-- LEFT: terms + project + plan -->
        <div class="flex flex-col gap-6">
          <!-- Agreement terms -->
          <div :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-muted-500">
              Agreement terms
            </h2>
            <div class="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
              <div>
                <div class="text-[12px] text-muted-500">
                  Financed amount
                </div>
                <div class="mt-1 font-heading text-[22px] font-extrabold text-white tabular-nums">
                  {{ formatCurrency(contract.amount) }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-muted-500">
                  Repayment term
                </div>
                <div class="mt-1 text-[18px] font-bold text-white tabular-nums">
                  {{ contract.termMonths }} months
                </div>
              </div>
              <div>
                <div class="text-[12px] text-muted-500">
                  Interest
                </div>
                <div class="mt-1 text-[18px] font-bold text-white tabular-nums">
                  {{ contract.interestRate > 0 ? `${(contract.interestRate * 100).toFixed(0)}% / mo` : '0% (interest-free)' }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-muted-500">
                  Monthly payment
                </div>
                <div class="mt-1 text-[18px] font-bold text-white tabular-nums">
                  {{ formatCurrency(contract.monthlyAmount) }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-muted-500">
                  Total repayable
                </div>
                <div class="mt-1 text-[18px] font-bold text-white tabular-nums">
                  {{ formatCurrency(contract.totalRepayable) }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-muted-500">
                  Signed
                </div>
                <div class="mt-1 text-[18px] font-bold text-white">
                  {{ fmtDate(contract.signedAt) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Repayment plan -->
          <div v-if="plan" :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-muted-500">
              Repayment plan
            </h2>
            <div class="mb-3 flex items-end justify-between">
              <div>
                <div class="text-[13px] text-muted-400">
                  Paid so far
                </div>
                <div class="font-heading text-[22px] font-extrabold text-white tabular-nums">
                  {{ formatCurrency(plan.paid) }} <span class="text-[14px] font-semibold text-muted-500">of {{ formatCurrency(plan.total) }}</span>
                </div>
              </div>
              <AdminStatusChip :status="plan.status" />
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-white/5">
              <div class="h-full rounded-full bg-[#22B07D]" :style="{ width: `${Math.min(100, Math.round((plan.paid / (plan.total || 1)) * 100))}%` }" />
            </div>
            <div class="mt-3 flex items-center justify-between text-[12.5px] text-muted-500">
              <span>{{ plan.monthsPaid }} / {{ plan.monthsTotal }} installments</span>
              <span>Next due {{ fmtDate(plan.nextDue) }}</span>
            </div>
          </div>

          <!-- Project details + milestones -->
          <div :class="cardClass">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-[13px] font-bold uppercase tracking-[0.05em] text-muted-500">
                Project
              </h2>
              <NuxtLink :to="`/admin/projects/${project.id}`" class="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-300 hover:text-primary-200">
                Open project <Icon name="lucide:external-link" class="size-3.5" />
              </NuxtLink>
            </div>
            <div class="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
              <span class="text-muted-400">Status <AdminStatusChip :status="project.status" class="ml-1" /></span>
              <span class="text-muted-400">Progress <span class="font-semibold text-white">{{ project.progress }}%</span></span>
              <span class="text-muted-400">Deadline <span class="font-semibold text-white">{{ fmtDate(project.deadline) }}</span></span>
            </div>
            <div v-if="project.milestones?.length" class="flex flex-col gap-2.5">
              <div v-for="m in project.milestones" :key="m.id" class="flex items-center gap-3 text-[13px]">
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full"
                  :class="m.status === 'COMPLETED' ? 'bg-[#22B07D]/15 text-[#22B07D]' : m.status === 'CURRENT' ? 'bg-[#F2C14E]/15 text-[#F2C14E]' : 'bg-white/5 text-muted-500'"
                >
                  <Icon :name="m.status === 'COMPLETED' ? 'lucide:check' : 'lucide:circle'" class="size-3" />
                </span>
                <span class="text-white">{{ m.title }}</span>
                <span class="ml-auto text-muted-500">{{ fmtDate(m.date) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: customer + signature -->
        <div class="flex flex-col gap-6">
          <div :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-muted-500">
              Customer
            </h2>
            <AdminUserCell :user="{ ...contract.user, email: contract.user.email || contract.user.phone || '—' }" />
            <div class="mt-4 flex flex-col gap-2 text-[13px]">
              <div v-if="contract.user.email" class="flex items-center gap-2 text-muted-400">
                <Icon name="lucide:mail" class="size-4 text-muted-500" /> {{ contract.user.email }}
              </div>
              <div v-if="contract.user.phone" class="flex items-center gap-2 text-muted-400">
                <Icon name="lucide:phone" class="size-4 text-muted-500" /> {{ contract.user.phone }}
              </div>
              <div class="flex items-center gap-2 text-muted-400">
                <Icon name="lucide:calendar" class="size-4 text-muted-500" /> Customer since {{ fmtDate(contract.user.createdAt) }}
              </div>
            </div>
            <NuxtLink :to="`/admin/users/${contract.user.id}`" class="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary-300 hover:text-primary-200">
              View customer <Icon name="lucide:arrow-right" class="size-3.5" />
            </NuxtLink>
          </div>

          <div :class="cardClass">
            <h2 class="mb-4 text-[13px] font-bold uppercase tracking-[0.05em] text-muted-500">
              E-signature
            </h2>
            <div v-if="contract.signature" class="rounded-[14px] border border-white/10 bg-white p-4">
              <img v-if="signatureIsImage" :src="contract.signature" alt="Customer signature" class="mx-auto max-h-32 w-auto">
              <div v-else class="py-4 text-center font-[cursive] text-[26px] text-muted-950">
                {{ contract.signature }}
              </div>
            </div>
            <div v-else class="rounded-[14px] border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-[13px] text-muted-500">
              No signature captured
            </div>
            <p class="mt-3 text-[12px] text-muted-500">
              Captured {{ fmtDate(contract.signedAt) }}. This agreement is legally binding under the Apex financing terms.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
