<script setup lang="ts">
import type { StaffRole } from '~~/shared/permissions'
import { PERMISSIONS, ROLES, STAFF_ROLES } from '~~/shared/permissions'
import { ADMIN_INPUT, ADMIN_LABEL, ADMIN_TH } from '~/utils/adminUi'

/**
 * Admin console — Team & roles (`Admin Console.dc.html`; V2 Phase 9 Team & access).
 *
 * Who can act inside the panel, what each role may do, and the invitations
 * that have not been accepted yet. Three rules from the design carry the
 * screen:
 *
 * - Invites are not members (badge 24). They sit in their own panel with the
 *   expiry and the withdraw control, never as "pending" rows in the staff
 *   table where they would inflate the headcount and read as people who can
 *   already act.
 * - Two changes are refused (badge 25): you cannot change or suspend your own
 *   access, and the last owner cannot be demoted. Both are refused with the
 *   reason in place of the buttons — and both are refused by the API too, so
 *   the explanation is the same whether a person or a script asks.
 * - The matrix is the enforcement (badge 26). It renders straight out of
 *   `shared/permissions.ts`, which is the table `requireStaffPermission()`
 *   checks on every admin route. There is no second copy to drift.
 */
definePageMeta({
  title: 'Team & roles',
  layout: 'admin',
  middleware: 'admin',
})

const toaster = useNuiToasts()
const { can, role: myRole } = useStaffAccess()
const allowed = computed(() => can('team.manage'))

const { data, refresh, pending } = await useFetch('/api/admin/team', {
  // The wall renders instead; requesting data the API will refuse only
  // produces a console 403 for a screen that was never going to show it.
  immediate: allowed.value,
})

const members = computed(() => data.value?.members ?? [])
const invites = computed(() => data.value?.invites ?? [])
const ownerCount = computed(() => data.value?.ownerCount ?? 0)
const viewerId = computed(() => data.value?.viewer?.id ?? null)

const summary = computed(() => {
  const m = members.value.length
  const o = ownerCount.value
  const i = invites.value.length
  return [
    `${m} ${m === 1 ? 'member' : 'members'}`,
    `${o} ${o === 1 ? 'owner' : 'owners'}`,
    `${i} ${i === 1 ? 'invite' : 'invites'} pending`,
  ].join(' · ')
})

const search = ref('')
const visibleMembers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) {
    return members.value
  }
  return members.value.filter(m =>
    `${m.firstName ?? ''} ${m.lastName ?? ''}`.toLowerCase().includes(q)
    || (m.email ?? '').toLowerCase().includes(q),
  )
})

function displayName(m: { firstName?: string | null, lastName?: string | null, email?: string | null }) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email || 'Unnamed'
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('') || '?'
}

/**
 * Why a row's controls are absent. Mirrors the server's own two refusals
 * so the sentence a person reads is the sentence a crafted request gets.
 */
function noEditReason(m: { id: string, staffRole: string }) {
  if (m.id === viewerId.value) {
    return 'You can\'t change your own access'
  }
  if (m.staffRole === 'owner' && ownerCount.value <= 1) {
    return 'Last owner — promote someone first'
  }
  return null
}

/*
 * "Last active" in the design has no column behind it — nothing in this
 * stack records a sign-in. The API answers with the member's most recent
 * audited action instead, which is a fact the database holds, and the
 * column heading says so. Deriving "Active now" from `updatedAt` would be
 * the fabricated session list Phase 7 deleted from Settings.
 */
function lastActionLabel(iso: string | null) {
  if (!iso) {
    return 'No recorded actions'
  }
  const then = new Date(iso)
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days === 0) {
    return `Today, ${then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  }
  if (days === 1) {
    return 'Yesterday'
  }
  if (days < 7) {
    return `${days} days ago`
  }
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function expiryLabel(iso: string) {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) {
    return 'Expired'
  }
  const days = Math.ceil(ms / 86_400_000)
  return days <= 1 ? 'Expires tomorrow' : `Expires in ${days} days`
}

function expiryUrgent(iso: string) {
  return new Date(iso).getTime() - Date.now() <= 86_400_000
}

// ---------------------------------------------------------------- invite

const inviteOpen = ref(false)
const invName = ref('')
const invEmail = ref('')
const invRole = ref<StaffRole>('pm')
const invTouchedEmail = ref(false)
const inviting = ref(false)

/**
 * The acceptance link, surfaced after an invite is created or resent,
 * with whether the email carrying it went (ADR-022). `mail.status` is
 * SENT only when the provider accepted the message; anything else and the
 * panel hands the link over and says so — a panel that reported "invite
 * sent" while no message left the building would be the discarded-file
 * defect Phase 6 removed from Support.
 */
const inviteLink = ref<{ name: string, email: string, url: string, mail: { status: string, error: string | null } | null } | null>(null)
const { data: appConfig } = useApexConfig()
const mailOn = computed(() => (appConfig.value as any)?.features?.mail === true)

const EMAIL_RE = /^[^@\s]+@[^\s@][^\s.@]*\.[^\s@]{2,}$/
const invEmailBad = computed(() =>
  invTouchedEmail.value && invEmail.value.trim().length > 0 && !EMAIL_RE.test(invEmail.value.trim()),
)
const inviteReady = computed(() => invName.value.trim().length > 0 && EMAIL_RE.test(invEmail.value.trim()))

function openInvite() {
  invName.value = ''
  invEmail.value = ''
  invRole.value = 'pm'
  invTouchedEmail.value = false
  inviteLink.value = null
  inviteOpen.value = true
}

async function confirmInvite() {
  if (!inviteReady.value || inviting.value) {
    return
  }
  inviting.value = true
  try {
    const result = await $fetch('/api/admin/team/invites', {
      method: 'POST',
      body: { name: invName.value.trim(), email: invEmail.value.trim(), role: invRole.value },
    })
    inviteOpen.value = false
    inviteLink.value = { name: result.invite.name, email: result.invite.email, url: result.acceptUrl, mail: result.mail ?? null }
    await refresh()
    if (result.mail?.status === 'SENT') {
      toaster.add({ title: 'Invitation emailed', description: `${result.invite.name} has 7 days to accept.`, icon: 'lucide:mail', progress: true })
    }
    else {
      toaster.add({ title: 'Invite created', description: 'We couldn\'t email it. Copy the link below and send it yourself.', icon: 'lucide:link', progress: true })
    }
  }
  catch (error: any) {
    toaster.add({ title: 'Invite failed', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    inviting.value = false
  }
}

const busyInvite = ref<string | null>(null)

async function resendInvite(id: string, name: string) {
  if (busyInvite.value) {
    return
  }
  busyInvite.value = id
  try {
    const result = await $fetch(`/api/admin/team/invites/${id}/resend`, { method: 'POST' })
    const email = invites.value.find(i => i.id === id)?.email ?? ''
    inviteLink.value = { name, email, url: result.acceptUrl, mail: result.mail ?? null }
    await refresh()
    if (result.mail?.status === 'SENT') {
      toaster.add({ title: 'New link emailed', description: 'The previous link stopped working.', icon: 'lucide:refresh-cw', progress: true })
    }
    else {
      toaster.add({ title: 'New link issued', description: 'We couldn\'t email it. Copy the link below and send it yourself; the previous one stopped working.', icon: 'lucide:link', progress: true })
    }
  }
  catch (error: any) {
    toaster.add({ title: 'Could not resend', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busyInvite.value = null
  }
}

async function cancelInvite(id: string) {
  if (busyInvite.value) {
    return
  }
  busyInvite.value = id
  try {
    await $fetch(`/api/admin/team/invites/${id}`, { method: 'DELETE' })
    inviteLink.value = null
    await refresh()
    toaster.add({ title: 'Invite withdrawn', description: 'The link stops working immediately.', icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    toaster.add({ title: 'Could not withdraw', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busyInvite.value = null
  }
}

async function copyLink(url: string) {
  const absolute = new URL(url, window.location.origin).toString()
  try {
    await navigator.clipboard.writeText(absolute)
    toaster.add({ title: 'Link copied', description: 'Paste it wherever you reach them.', icon: 'lucide:copy', progress: true })
  }
  catch {
    toaster.add({ title: 'Copy failed', description: absolute, icon: 'lucide:alert-triangle', progress: true })
  }
}

// ------------------------------------------- role change and suspension

/**
 * The design changes a role from the row's own select and confirms it with
 * a required reason, which the API stores on the audit entry. Suspension
 * and restore go through the same confirmation (a reason is required to
 * cut access, not to give it back). A cancelled change puts the select
 * back on the role the member still holds.
 */
const { ask } = useAdminConfirm()
const busyMember = ref<string | null>(null)

async function changeRole(m: { id: string, name: string, staffRole: StaffRole }, next: StaffRole, select: HTMLSelectElement) {
  if (next === m.staffRole) {
    return
  }
  const reason = await ask({
    title: `Change ${m.name} to ${ROLES[next].label}?`,
    body: 'Their access changes on their next request. This is recorded in the audit log.',
    points: next === 'owner' ? [{ tone: 'warning', text: 'Owners can change platform settings, refunds and everyone’s access, including yours.' }] : [],
    reason: { required: true, label: 'Reason', placeholder: 'e.g. Moving to the finance team', hint: 'Stored with the audit entry.' },
    confirmLabel: 'Change role',
  })
  if (reason === null) {
    select.value = m.staffRole
    return
  }
  busyMember.value = m.id
  try {
    await $fetch(`/api/admin/team/${m.id}`, { method: 'PATCH', body: { staffRole: next, reason } })
    await refresh()
    toaster.add({ title: 'Role changed', description: `${m.name} is now ${ROLES[next].label}.`, icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    select.value = m.staffRole
    toaster.add({ title: 'Could not change role', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busyMember.value = null
  }
}

async function toggleAccess(m: { id: string, name: string, status: string }) {
  const restoring = m.status === 'SUSPENDED'
  const reason = await ask(restoring
    ? { title: `Restore ${m.name}?`, body: 'They can sign in again with the role they held.', confirmLabel: 'Restore access' }
    : {
        title: `Suspend ${m.name}?`,
        body: 'Their current session is refused from its next request, and they cannot sign in until restored.',
        points: [{ tone: 'danger', text: 'Stops: every console screen and every admin request' }, { tone: 'success', text: 'Kept: their account, role and audit history' }],
        reason: { required: true, label: 'Reason', placeholder: 'e.g. Left the company on 31/10', hint: 'Stored with the audit entry.' },
        confirmLabel: 'Suspend access',
        danger: true,
      })
  if (reason === null) {
    return
  }
  busyMember.value = m.id
  try {
    await $fetch(`/api/admin/team/${m.id}`, { method: 'PATCH', body: { status: restoring ? 'ACTIVE' : 'SUSPENDED', ...(restoring ? {} : { reason }) } })
    await refresh()
    toaster.add({ title: restoring ? 'Access restored' : 'Access suspended', description: restoring ? `${m.name} can sign in again.` : `${m.name} is refused from their next request.`, icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    toaster.add({ title: 'Could not update access', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    busyMember.value = null
  }
}

async function askCancelInvite(id: string, email: string) {
  const reason = await ask({ title: `Withdraw the invite to ${email}?`, body: 'The link stops working immediately. You can invite them again later.', confirmLabel: 'Withdraw invite', danger: true })
  if (reason !== null) {
    await cancelInvite(id)
  }
}

const tab = ref<'members' | 'invites' | 'matrix'>('members')
const TAB_CLS = 'apex-ring -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center border-b-2 text-sm'
const SELECT = 'apex-ring border-line-rule bg-shell text-fg-heading h-9 w-full rounded-[10px] border px-2.5 text-[13.5px] disabled:opacity-60'
</script>

<template>
  <AdminPage gap="md">
    <AdminPageHeader title="Team &" accent="roles" :subtitle="`Eight fixed roles. Every screen in this console reads the matrix below, and so does the server. ${summary}`">
      <AdminButton variant="primary" @click="openInvite">
        <Icon name="lucide:user-plus" class="size-[15px]" />Invite staff
      </AdminButton>
    </AdminPageHeader>

    <div class="border-line-subtle flex gap-6 overflow-x-auto border-b" role="tablist" aria-label="Team sections">
      <button
        v-for="[k, l] in ([['members', `Members · ${members.length}`], ['invites', `Invites · ${invites.length}`], ['matrix', 'Role matrix']] as const)" :key="k"
        type="button" role="tab" :aria-selected="tab === k"
        :class="[TAB_CLS, tab === k ? 'border-accent text-fg-heading font-semibold' : 'text-fg-muted border-transparent font-medium']"
        @click="tab = k"
      >
        {{ l }}
      </button>
    </div>

    <!-- The invite form: the design's inline section, opened by "Invite staff". -->
    <section v-if="inviteOpen" class="bg-card border-line-subtle flex flex-col gap-3 rounded-2xl border px-5 py-[18px]" aria-label="Invite a colleague">
      <form id="invite-form" class="flex flex-wrap items-end gap-3" @submit.prevent="confirmInvite">
        <div class="min-w-[180px] flex-1">
          <label for="inv-name" :class="ADMIN_LABEL">Name</label>
          <input id="inv-name" v-model="invName" autocomplete="off" :class="ADMIN_INPUT">
        </div>
        <div class="min-w-[220px] flex-[1.4]">
          <label for="inv-email" :class="ADMIN_LABEL">Work email</label>
          <input id="inv-email" v-model="invEmail" type="email" placeholder="name@apexdigi.co.uk" autocomplete="off" :aria-invalid="invEmailBad" :class="ADMIN_INPUT" @blur="invTouchedEmail = true">
        </div>
        <div class="w-full sm:w-[220px]">
          <label for="inv-role" :class="ADMIN_LABEL">Role</label>
          <select id="inv-role" v-model="invRole" :class="SELECT" class="h-10!">
            <option v-for="r in STAFF_ROLES" :key="r" :value="r">
              {{ ROLES[r].label }}
            </option>
          </select>
        </div>
        <div class="flex gap-2.5">
          <AdminButton @click="inviteOpen = false">
            Cancel
          </AdminButton>
          <AdminButton type="submit" variant="primary" :disabled="!inviteReady || inviting">
            Send invite
          </AdminButton>
        </div>
      </form>
      <p class="text-xs" :class="invEmailBad || invRole === 'owner' ? 'text-st-warning-fg' : 'text-fg-muted'" aria-live="polite">
        <template v-if="invEmailBad">
          Enter a full email address.
        </template>
        <template v-else-if="invRole === 'owner'">
          Owners can change platform settings, refunds and everyone’s access, including yours.
        </template>
        <template v-else>
          {{ mailOn ? 'They get an email with a link valid for 7 days.' : 'Email is not configured, so you get the link to send yourself. It is valid for 7 days.' }} No access until they accept. {{ ROLES[invRole].label }}: {{ ROLES[invRole].covers }}.
        </template>
      </p>
    </section>

    <!-- The acceptance link after an invite or resend, with whether the email went (ADR-022). -->
    <section v-if="inviteLink" class="bg-accent-tint flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4" aria-live="polite">
      <Icon :name="inviteLink.mail?.status === 'SENT' ? 'lucide:mail-check' : 'lucide:link'" class="text-accent-ink size-5 shrink-0" />
      <span class="text-fg-heading min-w-[220px] flex-1 text-[13.5px] leading-normal">
        <template v-if="inviteLink.mail?.status === 'SENT'">Invitation emailed to {{ inviteLink.email }}. The link is below as well.</template>
        <template v-else>The invitation to {{ inviteLink.email }} was not emailed{{ inviteLink.mail?.error ? ` (${inviteLink.mail.error})` : '' }}. Send them this link yourself.</template>
        <span class="text-fg-muted mt-1 block break-all font-mono text-xs">{{ inviteLink.url }}</span>
      </span>
      <AdminButton size="sm" @click="copyLink(inviteLink.url)">
        <Icon name="lucide:copy" class="size-3.5" />Copy link
      </AdminButton>
      <button type="button" class="apex-ring text-fg-muted rounded p-1" aria-label="Dismiss" @click="inviteLink = null">
        <Icon name="lucide:x" class="size-4" />
      </button>
    </section>

    <!-- ===================================================== Members -->
    <section v-if="tab === 'members'" role="tabpanel" class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <div class="flex flex-wrap items-center gap-3 px-[22px] py-3.5">
        <span :class="ADMIN_TH" class="flex-1">Member</span>
        <input v-model="search" type="search" placeholder="Search name or email" aria-label="Search members" :class="ADMIN_INPUT" class="h-9! w-full sm:w-[240px]!">
      </div>
      <div v-if="pending" aria-hidden="true">
        <div v-for="i in 4" :key="i" class="border-line-soft h-[64px] animate-pulse border-t" />
      </div>
      <ul v-else>
        <li
          v-for="m in visibleMembers" :key="m.id"
          class="border-line-soft grid grid-cols-1 items-center gap-x-3.5 gap-y-2 border-t px-[18px] py-[13px] sm:px-[22px] lg:grid-cols-[minmax(0,1fr)_230px_170px_140px]"
        >
          <span class="flex min-w-0 items-center gap-3">
            <ApexPanelAvatar :person="m" :size="36" />
            <span class="min-w-0">
              <span class="text-fg-heading block truncate text-sm font-semibold">
                {{ displayName(m) }} <span v-if="m.id === viewerId" class="text-accent-ink text-xs font-medium">You</span>
                <AdminStatusChip v-if="m.status === 'SUSPENDED'" tone="danger" label="Suspended" class="ms-1 h-5! align-middle" />
              </span>
              <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ m.email }}</span>
            </span>
          </span>
          <span class="flex flex-col gap-1">
            <label :for="`role-${m.id}`" class="sr-only">Role for {{ displayName(m) }}</label>
            <select
              :id="`role-${m.id}`"
              :value="m.staffRole"
              :disabled="Boolean(noEditReason(m)) || busyMember === m.id"
              :class="SELECT"
              @change="changeRole({ id: m.id, name: displayName(m), staffRole: m.staffRole as StaffRole }, ($event.target as HTMLSelectElement).value as StaffRole, $event.target as HTMLSelectElement)"
            >
              <!-- `selected` per option: a select's `:value` is not rendered on the server. -->
              <option v-for="r in STAFF_ROLES" :key="r" :value="r" :selected="r === m.staffRole">
                {{ ROLES[r].label }}
              </option>
            </select>
            <span v-if="noEditReason(m)" class="text-fg-muted text-[11.5px]">{{ noEditReason(m) }}.</span>
          </span>
          <span class="text-fg-muted text-[12.5px]">
            <span class="lg:hidden">Last action: </span><ClientOnly>{{ lastActionLabel(m.lastActionAt) }}</ClientOnly>
          </span>
          <span class="lg:text-end">
            <button
              v-if="!noEditReason(m)"
              type="button"
              class="apex-ring rounded text-[13px] font-semibold"
              :class="m.status === 'SUSPENDED' ? 'text-accent-ink' : 'text-st-danger-fg'"
              :disabled="busyMember === m.id"
              @click="toggleAccess({ id: m.id, name: displayName(m), status: m.status })"
            >
              {{ m.status === 'SUSPENDED' ? 'Restore access' : 'Suspend' }}
            </button>
          </span>
        </li>
        <li v-if="!visibleMembers.length" class="border-line-soft text-fg-body border-t px-[22px] py-6 text-sm">
          No members match “{{ search }}”.
        </li>
      </ul>
      <p class="border-line-soft text-fg-muted border-t px-[22px] py-3 text-[12.5px]">
        “Last action” is the member’s most recent audited action. Nothing records a sign-in, so the console does not claim one.
      </p>
    </section>

    <!-- ===================================================== Invites -->
    <section v-else-if="tab === 'invites'" role="tabpanel" class="bg-card border-line-subtle overflow-hidden rounded-2xl border">
      <p class="text-fg-muted px-[22px] py-3.5 text-[13px]">
        Invited people have no access until they accept. Links expire after 7 days; resending issues a new link and the old one stops working.
      </p>
      <ul>
        <li v-for="i in invites" :key="i.id" class="border-line-soft grid grid-cols-1 items-center gap-x-3.5 gap-y-2 border-t px-[18px] py-[13px] sm:px-[22px] lg:grid-cols-[minmax(0,1fr)_160px_200px_auto]">
          <span class="min-w-0">
            <span class="text-fg-heading block truncate text-sm font-semibold">{{ i.name }}</span>
            <span class="text-fg-muted mt-0.5 block truncate text-[12.5px]">{{ i.email }}</span>
          </span>
          <span class="text-fg-body text-[13px]">{{ ROLES[i.role as StaffRole]?.label ?? i.role }}</span>
          <span class="text-[12.5px]" :class="expiryUrgent(i.expiresAt) ? 'text-st-warning-fg font-semibold' : 'text-fg-muted'"><ClientOnly>{{ expiryLabel(i.expiresAt) }}</ClientOnly></span>
          <span class="flex flex-wrap gap-2">
            <AdminButton size="sm" :disabled="busyInvite === i.id" @click="resendInvite(i.id, i.name)">
              Resend
            </AdminButton>
            <AdminButton size="sm" variant="danger-text" :disabled="busyInvite === i.id" @click="askCancelInvite(i.id, i.email)">
              Cancel invite
            </AdminButton>
          </span>
        </li>
        <li v-if="!invites.length" class="border-line-soft text-fg-body border-t px-[22px] pb-[22px] pt-4 text-sm">
          No pending invites.
        </li>
      </ul>
    </section>

    <!-- ===================================================== Matrix -->
    <section v-else role="tabpanel" class="bg-card border-line-subtle overflow-x-auto rounded-2xl border">
      <table class="w-full min-w-[920px] border-collapse">
        <caption class="sr-only">
          What each staff role may do. The server enforces this same table.
        </caption>
        <thead>
          <tr>
            <th scope="col" class="px-[22px] py-3.5 text-start" :class="ADMIN_TH">
              Permission
            </th>
            <th v-for="r in STAFF_ROLES" :key="r" scope="col" class="w-[92px] px-1 py-3.5 text-center text-[11.5px] font-bold leading-tight" :class="r === myRole ? 'text-accent-ink' : 'text-fg-muted'">
              {{ ROLES[r].label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in PERMISSIONS" :key="p.key" class="border-line-soft border-t">
            <th scope="row" class="px-[22px] py-2.5 text-start font-normal">
              <span class="text-fg-heading block text-[13.5px]">{{ p.label }}</span>
              <span class="text-fg-muted block text-xs">{{ p.detail }}</span>
            </th>
            <td v-for="r in STAFF_ROLES" :key="r" class="px-1 py-1.5">
              <span
                class="flex h-7 items-center justify-center rounded-lg"
                :class="[p.allow.includes(r) ? 'text-st-success-fg' : 'text-fg-muted opacity-45', r === myRole && 'bg-accent-tint']"
              >
                <Icon :name="p.allow.includes(r) ? 'lucide:check' : 'lucide:minus'" class="size-[15px]" :aria-label="p.allow.includes(r) ? 'Allowed' : 'Not allowed'" />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </AdminPage>
</template>
