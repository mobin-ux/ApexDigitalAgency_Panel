<script setup lang="ts">
import type { EnquiryFilter, EnquiryStatus } from '~~/shared/enquiry-status'
import { ENQUIRY_STATUS, ENQUIRY_STATUSES } from '~~/shared/enquiry-status'
import { ukDateTime } from '~/utils/adminFormat'
import { ADMIN_INPUT, ADMIN_LABEL } from '~/utils/adminUi'

/**
 * Website › Enquiries (`Admin Console.dc.html` `v_43leads`, ADR-026 phase
 * E): messages from the contact form on apexdigi.co.uk, which the site
 * forwards here as well as emailing the team. A list on the left with the
 * design's filters, the selected enquiry on the right: what they sent,
 * status and owner, staff-only notes, and the two decisions (lost, with a
 * reason; or convert to a client account).
 *
 * Real or absent: the design's "Marketing consent" and "Privacy notice
 * accepted" facts describe checkboxes the site's form does not have, so the
 * panel says what is true instead: no marketing consent was asked for, so
 * the reply is about this enquiry only. Enquiries that do not become a
 * client are deleted after 24 months (the owner's decision); the footnote
 * says so. The selected enquiry is in the address (`?enquiry=`), so the
 * Overview and the search can open one.
 */
definePageMeta({
  title: 'Enquiries',
  layout: 'admin',
  middleware: 'admin',
})

interface EnquiryRow {
  id: string
  ref: string
  name: string
  business: string
  topic: string
  status: EnquiryStatus
  owner: string | null
  ownerId: string | null
  receivedAt: string
}
interface EnquiryDetail {
  enquiry: EnquiryRow & {
    email: string
    phone: string
    message: string
    services: string[]
    plan: string
    budget: string
    reply: string
    source: string
    lostReason: string | null
    client: { id: string, name: string } | null
    converted: boolean
    convertedAt: string | null
    convertedBy: string | null
  }
  notes: { id: string, body: string, author: string, createdAt: string }[]
}
interface ListAnswer {
  items: EnquiryRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<EnquiryFilter, number>
  owners: { id: string, name: string }[]
  canConvert: boolean
}

const route = useRoute()
const router = useRouter()
const toaster = useNuiToasts()
const { ask } = useAdminConfirm()
const { refresh: refreshCounts } = useAdminNavCounts()

const FILTERS: { key: EnquiryFilter, label: string }[] = [
  { key: 'open', label: 'Open' },
  ...ENQUIRY_STATUSES.map(s => ({ key: s, label: ENQUIRY_STATUS[s].label })),
]

const filter = ref<EnquiryFilter>('open')
const page = ref(1)
watch(filter, () => (page.value = 1))
const { data: list, error, refresh } = await useFetch<ListAnswer>('/api/admin/website/enquiries', {
  query: computed(() => ({ filter: filter.value, page: page.value, pageSize: 50 })),
  key: 'website-enquiries',
})

/* The selection lives in the address; with none, the first row of the list. */
const selId = computed(() => {
  const wanted = typeof route.query.enquiry === 'string' ? route.query.enquiry : null
  return wanted ?? list.value?.items[0]?.id ?? null
})
const fetchApi = useRequestFetch()
const { data: detail, error: detailError, refresh: refreshDetail } = await useAsyncData<EnquiryDetail | null>(
  'website-enquiry',
  () => selId.value ? fetchApi<EnquiryDetail>(`/api/admin/website/enquiries/${selId.value}`) : Promise.resolve(null),
  { watch: [selId] },
)
const ld = computed(() => detail.value?.enquiry.id === selId.value ? detail.value : null)

const panel = ref<HTMLElement | null>(null)
function select(id: string) {
  router.replace({ query: { ...route.query, enquiry: id } })
  // Below `xl` the detail sits under the list; take the reader to it.
  if (import.meta.client && window.innerWidth < 1280) {
    nextTick(() => panel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

/* --------------------------------------------------------------- facts --- */

const facts = computed(() => {
  const e = ld.value?.enquiry
  if (!e) {
    return []
  }
  return [
    { k: 'Email', v: e.email },
    { k: 'Phone', v: e.phone || '—' },
    { k: 'Services', v: e.services.join(', ') || 'Not sure yet' },
    { k: 'Plan', v: e.plan || '—' },
    { k: 'Budget', v: e.budget || '—' },
    { k: 'Prefers', v: e.reply || 'Email' },
    { k: 'Sent from', v: e.source || 'Contact page' },
    { k: 'Marketing consent', v: 'Not asked · reply about this enquiry only' },
  ]
})
const mailto = computed(() => ld.value ? `mailto:${ld.value.enquiry.email}?subject=${encodeURIComponent('Your enquiry to Apex Digital')}` : '')
const decided = computed(() => ld.value ? ld.value.enquiry.status === 'won' || ld.value.enquiry.status === 'lost' : true)

/* ------------------------------------------------------------- changes --- */

const busy = ref(false)
async function patch(body: Record<string, unknown>, done: string) {
  if (!ld.value) {
    return
  }
  busy.value = true
  try {
    detail.value = await $fetch<EnquiryDetail>(`/api/admin/website/enquiries/${ld.value.enquiry.id}`, { method: 'PATCH', body })
    await Promise.all([refresh(), refreshCounts()])
    toaster.add({ title: done, icon: 'lucide:check', progress: true })
  }
  catch (err) {
    toaster.add({ title: 'Not changed', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
    await refreshDetail()
  }
  finally {
    busy.value = false
  }
}

async function markLost() {
  const e = ld.value?.enquiry
  if (!e) {
    return
  }
  const reason = await ask({
    title: `Mark ${e.business || e.name} as lost?`,
    body: 'It moves to Lost. You can reopen it by changing the status.',
    reason: { required: true, label: 'Reason', placeholder: 'e.g. Went with a one-off build elsewhere', hint: 'Kept for reporting. Never sent to the enquirer.' },
    confirmLabel: 'Mark as lost',
  })
  if (reason !== null) {
    await patch({ status: 'lost', lostReason: reason }, 'Marked as lost')
  }
}

async function onStatus(event: Event) {
  const select = event.target as HTMLSelectElement
  const next = select.value as EnquiryStatus
  if (!ld.value || next === ld.value.enquiry.status) {
    return
  }
  if (next === 'lost') {
    // Lost needs a reason; put the select back until the dialog answers.
    select.value = ld.value.enquiry.status
    await markLost()
    return
  }
  await patch({ status: next }, `Status: ${ENQUIRY_STATUS[next].label}`)
}

async function onOwner(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  await patch({ ownerId: value || null }, value ? `Given to ${list.value?.owners.find(o => o.id === value)?.name ?? 'them'}` : 'Unassigned')
}

const note = ref('')
async function addNote() {
  const body = note.value.trim()
  if (!body || !ld.value) {
    return
  }
  busy.value = true
  try {
    detail.value = await $fetch<EnquiryDetail>(`/api/admin/website/enquiries/${ld.value.enquiry.id}/notes`, { method: 'POST', body: { body } })
    note.value = ''
  }
  catch (err) {
    toaster.add({ title: 'Note not added', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}

async function convert() {
  const e = ld.value?.enquiry
  if (!e) {
    return
  }
  const go = await ask({
    title: `Create a portal account for ${e.business || e.name}?`,
    body: `${e.name} gets an email at ${e.email} to choose a password. Accounts are active from the start, so they can order straight away.`,
    points: [
      { tone: 'success', text: 'The enquiry is marked Won and linked to the new client' },
      { tone: 'info', text: 'The message and staff notes stay here, for staff only' },
    ],
    confirmLabel: 'Create account',
  })
  if (go === null) {
    return
  }
  busy.value = true
  try {
    const answer = await $fetch<EnquiryDetail & { linked: boolean, mail: { status: string, error: string | null } | null }>(`/api/admin/website/enquiries/${e.id}/convert`, { method: 'POST' })
    detail.value = answer
    await Promise.all([refresh(), refreshCounts()])
    if (answer.linked) {
      toaster.add({ title: `${e.business || e.name} is now a client`, description: 'They already had an account with this address, so it was linked and nothing was emailed.', icon: 'lucide:check', progress: true })
    }
    else if (answer.mail?.status === 'SENT') {
      toaster.add({ title: `${e.business || e.name} is now a client`, description: `The set-password email went to ${e.email}.`, icon: 'lucide:check', progress: true })
    }
    else {
      toaster.add({ title: 'Account created, email not sent', description: `${answer.mail?.error ?? 'The email is queued.'} They can use "Forgot password" on the sign-in page.`, icon: 'lucide:info', progress: true })
    }
  }
  catch (err) {
    toaster.add({ title: 'Not converted', description: errorMessage(err), icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busy.value = false
  }
}

const PILL = 'apex-ring inline-flex h-8 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-full border px-[13px] text-[13px]'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Website" accent="enquiries" subtitle="Messages from the contact form on apexdigi.co.uk." />

    <div class="flex flex-wrap gap-2" role="group" aria-label="Filter enquiries">
      <button
        v-for="f in FILTERS" :key="f.key" type="button" :aria-pressed="filter === f.key"
        :class="[PILL, filter === f.key ? 'bg-accent border-transparent font-semibold text-white' : 'border-line-subtle text-fg-heading hover:bg-hover font-medium']"
        @click="filter = f.key"
      >
        {{ f.label }} <span class="tabular-nums opacity-70">{{ list?.counts?.[f.key] ?? 0 }}</span>
      </button>
    </div>

    <AdminLoadError v-if="error" :error="error" title="Could not load enquiries" @retry="refresh" />
    <AdminEmptyState
      v-else-if="list && Object.values(list.counts).every(n => n === 0)"
      icon="solar:inbox-linear"
      title="No enquiries yet"
      subtitle="Messages sent from the contact form on apexdigi.co.uk arrive here, and by email to the team."
    />
    <div v-else class="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section class="bg-card border-line-subtle overflow-hidden rounded-2xl border" aria-label="Enquiries">
        <p v-if="list && !list.items.length" class="text-fg-body px-5 py-6 text-sm">
          No enquiries with this status.
        </p>
        <ul v-else>
          <li v-for="(l, i) in list?.items ?? []" :key="l.id">
            <button
              type="button" :aria-pressed="selId === l.id"
              class="apex-ring flex w-full flex-col gap-1 border-s-[3px] px-[18px] py-[13px] text-start"
              :class="[i ? 'border-t-line-soft border-t' : '', selId === l.id ? 'border-s-accent bg-raised' : 'hover:bg-raised border-s-transparent']"
              @click="select(l.id)"
            >
              <span class="flex items-center gap-2">
                <span class="text-fg-heading min-w-0 flex-1 truncate text-sm font-semibold">{{ l.name }}</span>
                <AdminStatusChip :tone="ENQUIRY_STATUS[l.status].tone" :label="ENQUIRY_STATUS[l.status].label" />
              </span>
              <span class="text-fg-body truncate text-[12.5px]">{{ [l.business, l.topic].filter(Boolean).join(' · ') }}</span>
              <span class="text-fg-muted text-xs">{{ ukDateTime(l.receivedAt) }} · {{ l.owner ?? 'Unassigned' }}</span>
            </button>
          </li>
        </ul>
        <AdminPager v-if="list && list.pageCount > 1" v-model:page="page" :page-count="list.pageCount" :total="list.total" noun="enquiries" />
      </section>

      <section v-if="detailError && !ld" ref="panel" class="bg-card border-line-subtle rounded-2xl border p-6">
        <AdminLoadError :error="detailError" title="Could not load this enquiry" @retry="refreshDetail" />
      </section>
      <section v-else-if="ld" ref="panel" class="bg-card border-line-subtle flex scroll-mt-[84px] flex-col gap-[18px] rounded-2xl border px-5 py-[22px] sm:px-6" :aria-label="`Enquiry from ${ld.enquiry.name}`">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div class="min-w-0 flex-1">
            <h2 class="font-heading text-fg-heading text-[22px] font-extrabold tracking-[-0.015em]">
              {{ ld.enquiry.name }}
            </h2>
            <p class="text-fg-body mt-1 text-[13.5px]">
              {{ [ld.enquiry.business, ld.enquiry.topic].filter(Boolean).join(' · ') }} · received {{ ukDateTime(ld.enquiry.receivedAt) }}
            </p>
          </div>
          <AdminButton :to="mailto" class="self-start">
            <Icon name="lucide:mail" class="size-[15px]" /> Reply by email
          </AdminButton>
        </div>

        <div class="bg-raised text-fg-heading whitespace-pre-line break-words rounded-xl px-[18px] py-4 text-[14.5px] leading-[1.65]">
          {{ ld.enquiry.message || 'No message, only the details below.' }}
        </div>

        <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div v-for="f in facts" :key="f.k" class="flex min-w-0 flex-col gap-[3px]">
            <dt class="text-fg-muted text-xs">
              {{ f.k }}
            </dt>
            <dd class="text-fg-heading break-words text-sm">
              {{ f.v }}
            </dd>
          </div>
        </dl>

        <div class="border-line-soft grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
          <label class="flex flex-col">
            <span :class="ADMIN_LABEL">Status</span>
            <select :class="ADMIN_INPUT" :disabled="busy || ld.enquiry.converted" @change="onStatus">
              <option v-for="s in ENQUIRY_STATUSES" :key="s" :value="s" :selected="s === ld.enquiry.status">{{ ENQUIRY_STATUS[s].label }}</option>
            </select>
          </label>
          <label class="flex flex-col">
            <span :class="ADMIN_LABEL">Owner</span>
            <select :class="ADMIN_INPUT" :disabled="busy" @change="onOwner">
              <option value="" :selected="!ld.enquiry.ownerId">Unassigned</option>
              <option v-for="o in list?.owners ?? []" :key="o.id" :value="o.id" :selected="o.id === ld.enquiry.ownerId">{{ o.name }}</option>
            </select>
          </label>
        </div>

        <div v-if="ld.enquiry.converted" class="bg-st-success-bg text-fg-heading rounded-xl px-3.5 py-3 text-[13.5px]">
          Client account {{ ld.enquiry.convertedAt ? `created ${ukDateTime(ld.enquiry.convertedAt).slice(0, 10)}` : 'linked' }}{{ ld.enquiry.convertedBy ? ` by ${ld.enquiry.convertedBy}` : '' }}.
          <NuxtLink v-if="ld.enquiry.client" :to="`/admin/users/${ld.enquiry.client.id}`" class="apex-ring text-accent-ink rounded font-semibold">
            Open {{ ld.enquiry.client.name }}
          </NuxtLink>
          <span v-else>The account has since been removed.</span>
        </div>
        <div v-else-if="ld.enquiry.status === 'lost'" class="bg-chip text-fg-heading rounded-xl px-3.5 py-3 text-[13.5px]">
          Lost: {{ ld.enquiry.lostReason }}
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <span class="text-fg-muted text-xs font-bold uppercase tracking-[0.05em]">Staff notes</span>
            <AdminStatusChip tone="warning" label="Staff only" />
          </div>
          <p v-for="n in ld.notes" :key="n.id" class="bg-st-warning-bg text-fg-heading whitespace-pre-line break-words rounded-[10px] border border-dashed border-[#D9A521] px-3 py-2.5 text-[13.5px] leading-normal">
            <span class="text-fg-muted mb-[3px] block text-xs">{{ n.author }} · {{ ukDateTime(n.createdAt) }}</span>{{ n.body }}
          </p>
          <form class="flex gap-2" @submit.prevent="addNote">
            <label for="enquiry-note" class="sr-only">Add a staff note</label>
            <input
              id="enquiry-note" v-model="note" maxlength="2000" :class="ADMIN_INPUT" class="flex-1 border-dashed border-[#D9A521]"
              placeholder="Add a note, e.g. called, left voicemail"
            >
            <AdminButton type="submit" :disabled="busy || !note.trim()">
              Add note
            </AdminButton>
          </form>
        </div>

        <div v-if="!ld.enquiry.converted && (!decided || (ld.enquiry.status === 'won' && list?.canConvert))" class="border-line-soft flex flex-wrap justify-end gap-2.5 border-t pt-3.5">
          <AdminButton v-if="!decided" :disabled="busy" @click="markLost">
            Mark as lost
          </AdminButton>
          <AdminButton v-if="list?.canConvert" variant="primary" :disabled="busy" @click="convert">
            Convert to client
          </AdminButton>
        </div>
      </section>
    </div>

    <p class="text-fg-muted text-xs">
      Enquiries that do not become a client are deleted 24 months after they arrive, with their notes.
    </p>
  </AdminPage>
</template>
