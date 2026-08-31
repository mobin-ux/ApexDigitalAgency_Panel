<script setup lang="ts">
import type { StaffRole } from '~~/shared/permissions'
import { PERMISSIONS, ROLES, STAFF_ROLES } from '~~/shared/permissions'

/**
 * Admin — Team & access (V2 Phase 9, `Admin - Team & Platform.dc.html`).
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
  title: 'Team & access',
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
 * The acceptance link, surfaced after an invite is created or resent.
 * There is no mail provider in this stack, so nothing is emailed — and a
 * panel that reported "invite sent" while no message left the building
 * would be the discarded-file defect Phase 6 removed from Support.
 */
const inviteLink = ref<{ name: string, url: string } | null>(null)

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
    inviteLink.value = { name: result.invite.name, url: result.acceptUrl }
    await refresh()
    toaster.add({ title: 'Invite created', description: `${result.invite.name} has 7 days to accept.`, icon: 'lucide:mail', progress: true })
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
    inviteLink.value = { name, url: result.acceptUrl }
    await refresh()
    toaster.add({ title: 'New link issued', description: 'The previous link stopped working.', icon: 'lucide:refresh-cw', progress: true })
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
    toaster.add({ title: 'Link copied', description: 'Send it to them yourself — nothing is emailed.', icon: 'lucide:copy', progress: true })
  }
  catch {
    toaster.add({ title: 'Copy failed', description: absolute, icon: 'lucide:alert-triangle', progress: true })
  }
}

// ----------------------------------------------------------- change role

interface EditTarget { id: string, name: string, staffRole: StaffRole, status: string }

const roleOpen = ref(false)
const editMember = ref<EditTarget | null>(null)
const newRole = ref<StaffRole>('pm')
const savingRole = ref(false)

const lastOwnerBlock = computed(() =>
  Boolean(editMember.value)
  && editMember.value!.staffRole === 'owner'
  && ownerCount.value <= 1
  && newRole.value !== 'owner',
)

function openRoleModal(m: EditTarget) {
  editMember.value = m
  newRole.value = m.staffRole
  roleOpen.value = true
}

async function confirmRoleChange() {
  const target = editMember.value
  if (!target || lastOwnerBlock.value || savingRole.value || newRole.value === target.staffRole) {
    return
  }
  savingRole.value = true
  try {
    await $fetch(`/api/admin/team/${target.id}`, { method: 'PATCH', body: { staffRole: newRole.value } })
    roleOpen.value = false
    await refresh()
    toaster.add({ title: 'Role changed', description: `${target.name} is now ${ROLES[newRole.value].label}.`, icon: 'lucide:check', progress: true })
  }
  catch (error: any) {
    toaster.add({ title: 'Could not change role', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    savingRole.value = false
  }
}

// -------------------------------------------------------- suspend/restore

/*
 * A deliberate addition to the mockup, which toggles suspension straight
 * from the row. Cutting a colleague's access is destructive and instant,
 * and badge 30 wants a typed reason on the audit entry for an access
 * change — so Suspend asks for one and Restore only confirms.
 */
const suspendOpen = ref(false)
const suspendTarget = ref<EditTarget | null>(null)
const suspendReason = ref('')
const savingSuspend = ref(false)
const suspendRestoring = computed(() => suspendTarget.value?.status === 'SUSPENDED')

function openSuspend(m: EditTarget) {
  suspendTarget.value = m
  suspendReason.value = ''
  suspendOpen.value = true
}

async function confirmSuspend() {
  const target = suspendTarget.value
  if (!target || savingSuspend.value) {
    return
  }
  const restoring = target.status === 'SUSPENDED'
  if (!restoring && !suspendReason.value.trim()) {
    return
  }
  savingSuspend.value = true
  try {
    await $fetch(`/api/admin/team/${target.id}`, {
      method: 'PATCH',
      body: {
        status: restoring ? 'ACTIVE' : 'SUSPENDED',
        ...(restoring ? {} : { reason: suspendReason.value.trim() }),
      },
    })
    suspendOpen.value = false
    await refresh()
    toaster.add({
      title: restoring ? 'Access restored' : 'Access suspended',
      description: restoring ? `${target.name} can sign in again.` : `${target.name} is refused from their next request.`,
      icon: 'lucide:check',
      progress: true,
    })
  }
  catch (error: any) {
    toaster.add({ title: 'Could not update access', description: error?.data?.message || 'Please try again.', icon: 'lucide:alert-triangle', progress: true })
  }
  finally {
    savingSuspend.value = false
  }
}

const CARD = 'rounded-2xl border border-muted-200 bg-white dark:border-white/10 dark:bg-muted-800'
const AVATAR = 'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9B79F6] to-[#6C40E8] text-[12.5px] font-bold text-white'
const GHOST_BTN = 'apex-focus inline-flex min-h-[38px] cursor-pointer items-center rounded-xl border border-muted-200 bg-muted-100 px-3.5 text-[13px] font-semibold text-muted-800 transition-colors hover:bg-muted-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10'
const INPUT = 'w-full rounded-xl border border-muted-200 bg-white px-3.5 py-3 text-[15px] text-muted-900 outline-none placeholder:text-muted-400 focus:border-primary-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
</script>

<template>
  <div class="mx-auto flex max-w-[1240px] flex-col gap-6 pb-10 font-sans">
    <AdminAccessWall
      v-if="!allowed"
      permission="team.manage"
      title="Team and access are restricted"
      body="Inviting staff, changing roles and reading the audit log decide who can act on client money and files, so they are limited to the roles below."
    />

    <template v-else>
      <AdminPageHeader dense title="Team & access" :subtitle="summary">
        <BaseButton rounded="lg" variant="primary" size="lg" @click="openInvite">
          <Icon name="lucide:user-plus" class="size-4" />
          <span>Invite a team member</span>
        </BaseButton>
      </AdminPageHeader>

      <!--
        The acceptance link, shown once after creating or resending an
        invite. Nothing emails it — there is no mail provider — so the panel
        hands it over and says as much rather than implying a message went out.
      -->
      <div
        v-if="inviteLink"
        role="status"
        class="flex flex-wrap items-center gap-3 rounded-2xl border border-[#6EA8FE]/30 bg-[#6EA8FE]/[0.07] p-[18px]"
      >
        <Icon name="lucide:link" class="size-5 shrink-0 text-[#6EA8FE]" />
        <div class="min-w-0 flex-1">
          <div class="text-muted-900 text-sm font-semibold dark:text-white">
            Send {{ inviteLink.name }} their acceptance link
          </div>
          <p class="text-muted-600 dark:text-muted-300 mt-1 text-[13px] leading-[1.55]">
            No email was sent — this platform has no mail provider yet. Pass the link on yourself; it works once and expires in 7 days.
          </p>
          <code class="bg-muted-100 text-muted-700 dark:text-muted-300 mt-2 block break-all rounded-lg px-3 py-2 font-mono text-xs dark:bg-black/30">{{ inviteLink.url }}</code>
        </div>
        <button type="button" :class="GHOST_BTN" @click="copyLink(inviteLink.url)">
          <Icon name="lucide:copy" class="me-2 size-4" />Copy link
        </button>
      </div>

      <!-- ============ PENDING INVITES (badge 24) ============ -->
      <section v-if="invites.length" aria-label="Pending invitations" class="rounded-2xl border border-[#D9A521]/30 bg-[#D9A521]/[0.06] p-[18px]">
        <div class="flex items-center gap-[11px]">
          <span aria-hidden="true" class="inline-flex size-[34px] shrink-0 items-center justify-center rounded-xl bg-[#D9A521]/16 text-[#F2C14E]">
            <Icon name="lucide:mail" class="size-[18px]" />
          </span>
          <div class="min-w-0 flex-1">
            <div class="font-heading text-muted-900 text-base font-bold dark:text-white">
              {{ invites.length }} {{ invites.length === 1 ? 'invite' : 'invites' }} not accepted yet
            </div>
            <p class="text-muted-600 dark:text-muted-300 mt-[3px] text-[13px]">
              They have no access until they accept. Invites expire after 7 days.
            </p>
          </div>
        </div>

        <div class="border-muted-200 dark:bg-muted-800 mt-3.5 rounded-xl border bg-white px-4 dark:border-white/10">
          <div
            v-for="(invite, index) in invites"
            :key="invite.id"
            class="flex min-h-16 flex-wrap items-center gap-3 py-3"
            :class="index < invites.length - 1 ? 'border-muted-200 border-b dark:border-white/5' : ''"
          >
            <span aria-hidden="true" :class="AVATAR">{{ initials(invite.name) }}</span>
            <span class="min-w-0 flex-1">
              <span class="text-muted-900 block truncate text-[14.5px] font-semibold dark:text-white">{{ invite.name }}</span>
              <span class="text-muted-500 mt-[3px] block truncate text-[12.5px]">{{ invite.email }}</span>
            </span>
            <span class="w-[150px] shrink-0">
              <AdminRoleChip :role="invite.role as StaffRole" />
            </span>
            <span
              class="w-[130px] shrink-0 text-[12.5px]"
              :class="expiryUrgent(invite.expiresAt) ? 'text-[#F2C14E]' : 'text-muted-500'"
            >{{ expiryLabel(invite.expiresAt) }}</span>
            <span class="flex shrink-0 gap-2">
              <button type="button" :class="GHOST_BTN" :disabled="busyInvite === invite.id" @click="resendInvite(invite.id, invite.name)">
                Resend
              </button>
              <button
                type="button"
                class="apex-focus border-muted-200 text-muted-600 hover:bg-muted-100 dark:text-muted-300 inline-flex min-h-[38px] cursor-pointer items-center rounded-xl border px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/5"
                :disabled="busyInvite === invite.id"
                @click="cancelInvite(invite.id)"
              >
                Cancel
              </button>
            </span>
          </div>
        </div>
      </section>

      <!-- ============ MEMBERS (badge 25) ============ -->
      <section aria-label="Team members" class="flex flex-col gap-3">
        <label class="border-muted-200 focus-within:border-primary-400 dark:bg-muted-800 flex max-w-[320px] items-center gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 dark:border-white/10">
          <Icon name="lucide:search" class="text-muted-400 size-4 shrink-0" />
          <input
            v-model="search"
            aria-label="Search team"
            placeholder="Search team"
            class="text-muted-900 placeholder:text-muted-400 dark:placeholder:text-muted-500 min-w-0 flex-1 border-none bg-transparent text-[13.5px] outline-none dark:text-white"
          >
        </label>

        <div class="overflow-hidden" :class="CARD">
          <div
            aria-hidden="true"
            class="border-muted-200 bg-muted-50 text-muted-500 flex items-center gap-3.5 border-b px-[18px] py-3 text-[11px] font-extrabold uppercase tracking-[0.06em] dark:border-white/10 dark:bg-white/[0.02]"
          >
            <span class="min-w-0 flex-1">Member</span>
            <span class="w-[170px] shrink-0">Role</span>
            <span class="w-[110px] shrink-0 text-end">Projects</span>
            <span class="w-[150px] shrink-0 text-end">Last action</span>
            <span class="w-[230px] shrink-0 text-end">Access</span>
          </div>

          <div v-if="pending" aria-hidden="true" class="flex flex-col">
            <div v-for="i in 4" :key="i" class="border-muted-200 bg-muted-100/60 h-[66px] animate-pulse border-b last:border-b-0 dark:border-white/5 dark:bg-white/[0.02]" />
          </div>

          <template v-else>
            <div
              v-for="(m, index) in visibleMembers"
              :key="m.id"
              class="flex min-h-[66px] flex-wrap items-center gap-3.5 px-[18px] py-3.5"
              :class="[
                index < visibleMembers.length - 1 ? 'border-muted-200 border-b dark:border-white/5' : '',
                m.status === 'SUSPENDED' ? 'opacity-70' : '',
              ]"
            >
              <span class="flex min-w-0 flex-1 items-center gap-3">
                <span aria-hidden="true" :class="AVATAR">{{ initials(displayName(m)) }}</span>
                <span class="min-w-0">
                  <span class="flex items-center gap-2">
                    <span class="text-muted-900 truncate text-[14.5px] font-semibold dark:text-white">{{ displayName(m) }}</span>
                    <span
                      v-if="m.id === viewerId"
                      class="bg-muted-100 text-muted-500 shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-extrabold uppercase tracking-[0.04em] dark:bg-white/5"
                    >You</span>
                  </span>
                  <span class="text-muted-500 mt-[3px] block truncate text-xs">{{ m.email }}</span>
                </span>
              </span>

              <span class="w-[170px] shrink-0">
                <AdminRoleChip :role="m.staffRole as StaffRole" />
              </span>

              <span
                class="w-[110px] shrink-0 text-end text-[13.5px]"
                :class="m.status === 'SUSPENDED'
                  ? 'text-[#EC6453]'
                  : (m._count.managedProjects === 0 ? 'text-muted-400' : 'text-muted-700 dark:text-muted-300')"
              >
                {{ m.status === 'SUSPENDED'
                  ? 'Access suspended'
                  : (m._count.managedProjects === 0
                    ? 'No projects'
                    : `${m._count.managedProjects} ${m._count.managedProjects === 1 ? 'project' : 'projects'}`) }}
              </span>

              <span class="text-muted-500 w-[150px] shrink-0 text-end text-[12.5px]">{{ lastActionLabel(m.lastActionAt) }}</span>

              <span class="flex w-[230px] shrink-0 justify-end gap-2">
                <template v-if="!noEditReason(m)">
                  <button
                    type="button"
                    :class="GHOST_BTN"
                    @click="openRoleModal({ id: m.id, name: displayName(m), staffRole: m.staffRole as StaffRole, status: m.status })"
                  >
                    Change role
                  </button>
                  <button
                    type="button"
                    class="apex-focus inline-flex min-h-[38px] cursor-pointer items-center rounded-xl border px-3.5 text-[13px] font-semibold transition-colors"
                    :class="m.status === 'SUSPENDED'
                      ? 'border-[#22B07D]/40 text-[#22B07D] hover:bg-[#22B07D]/10'
                      : 'border-[#EC6453]/35 text-[#EC6453] hover:bg-[#EC6453]/10'"
                    @click="openSuspend({ id: m.id, name: displayName(m), staffRole: m.staffRole as StaffRole, status: m.status })"
                  >
                    {{ m.status === 'SUSPENDED' ? 'Restore' : 'Suspend' }}
                  </button>
                </template>
                <!--
                  Badge 25: the refusal is stated where the buttons would be,
                  rather than a disabled control with nothing to explain it.
                -->
                <span v-else class="text-muted-500 text-end text-[12.5px] leading-[1.4]">{{ noEditReason(m) }}</span>
              </span>
            </div>

            <AdminEmptyState
              v-if="!visibleMembers.length"
              icon="lucide:users"
              title="No one matches that search"
              subtitle="Clear the search to see the whole team."
            />
          </template>
        </div>
      </section>

      <!-- ============ ROLE MATRIX (badge 26) ============ -->
      <section aria-label="What each role can do" class="mt-1">
        <div class="mb-3 flex items-center gap-[11px]">
          <ApexSectionLabel>What each role can do</ApexSectionLabel>
          <span class="grow" />
          <span class="text-muted-500 text-[12.5px]">Fixed roles · no per-user overrides</span>
        </div>

        <div class="overflow-x-auto" :class="CARD">
          <table class="w-full min-w-[880px] border-collapse">
            <caption class="sr-only">
              Staff permissions by role. This table is the object the panel enforces.
            </caption>
            <thead>
              <tr class="border-muted-200 bg-muted-50 border-b dark:border-white/10 dark:bg-white/[0.02]">
                <th scope="col" class="text-muted-500 px-[18px] py-3 text-start text-[11px] font-extrabold uppercase tracking-[0.06em]">
                  Permission
                </th>
                <th
                  v-for="key in STAFF_ROLES"
                  :key="key"
                  scope="col"
                  class="w-[88px] px-1 py-3 text-center text-[11px] font-extrabold uppercase tracking-[0.04em]"
                  :class="key === myRole ? 'text-primary-600 dark:text-primary-200' : 'text-muted-500'"
                >
                  {{ ROLES[key].label.replace('Project manager', 'PM').replace('Support agent', 'Support').replace('Read-only', 'Read') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(perm, index) in PERMISSIONS"
                :key="perm.key"
                :class="index < PERMISSIONS.length - 1 ? 'border-muted-200 border-b dark:border-white/5' : ''"
              >
                <th scope="row" class="min-w-[260px] px-[18px] py-3.5 text-start font-normal">
                  <span class="text-muted-900 block text-sm font-semibold dark:text-white">{{ perm.label }}</span>
                  <span class="text-muted-500 mt-[3px] block text-xs">{{ perm.detail }}</span>
                </th>
                <td
                  v-for="key in STAFF_ROLES"
                  :key="key"
                  class="w-[88px] px-1 py-3.5 text-center"
                  :class="key === myRole ? 'bg-primary-500/[0.06]' : ''"
                >
                  <span
                    class="inline-flex size-6 items-center justify-center rounded-full"
                    :class="perm.allow.includes(key)
                      ? 'bg-[#22B07D]/16 text-[#22B07D]'
                      : 'bg-muted-100 text-muted-400 dark:bg-white/5 dark:text-muted-500'"
                  >
                    <Icon :name="perm.allow.includes(key) ? 'lucide:check' : 'lucide:minus'" class="size-3" aria-hidden="true" />
                    <span class="sr-only">{{ perm.allow.includes(key) ? 'Allowed' : 'Not allowed' }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-muted-500 mt-3.5 text-xs leading-[1.5]">
          This table is not documentation of the rules — it is the rules. Every <code class="font-mono">/api/admin/**</code> route checks the same object before it answers, so a tick here and a refusal there cannot disagree.
        </p>
      </section>
    </template>

    <!-- ========================= INVITE MODAL ========================= -->
    <div v-if="inviteOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Invite a team member">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="inviteOpen = false" />
      <div class="apex-pop border-muted-200 dark:bg-muted-800 relative flex max-h-[86vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_40px_90px_rgba(0,0,0,.55)] dark:border-white/10">
        <div class="border-muted-200 shrink-0 border-b px-6 pb-4 pt-[22px] dark:border-white/10">
          <div class="font-heading text-muted-900 text-xl font-extrabold tracking-[-0.01em] dark:text-white">
            Invite a team member
          </div>
          <p class="text-muted-600 dark:text-muted-300 mt-1.5 text-[13.5px]">
            They get a single-use link, choose their own password, and the invite expires in 7 days.
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label for="inv-name" class="text-muted-900 mb-2 block text-[13px] font-semibold dark:text-white">Full name</label>
              <input id="inv-name" v-model="invName" placeholder="Leah Nguyen" :class="INPUT">
            </div>
            <div>
              <label for="inv-email" class="text-muted-900 mb-2 block text-[13px] font-semibold dark:text-white">Work email</label>
              <input
                id="inv-email"
                v-model="invEmail"
                type="email"
                placeholder="leah@apexdigi.co.uk"
                :class="[INPUT, invEmailBad ? '!border-[#EC6453]' : '']"
                :aria-invalid="invEmailBad || undefined"
                @blur="invTouchedEmail = true"
              >
              <span v-if="invEmailBad" class="mt-[7px] block text-xs text-[#EC6453]">That doesn't look like an email address.</span>
            </div>
          </div>

          <div class="text-muted-500 mt-[22px] text-[11px] font-bold uppercase tracking-[0.05em]">
            Role
          </div>
          <div class="mt-2.5 flex flex-col gap-2">
            <button
              v-for="key in STAFF_ROLES"
              :key="key"
              type="button"
              :aria-pressed="invRole === key"
              class="apex-focus flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-start transition-colors"
              :class="invRole === key
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-muted-200 bg-muted-50 hover:bg-muted-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07]'"
              @click="invRole = key"
            >
              <span aria-hidden="true" class="size-2.5 shrink-0 rounded-full" :class="ROLE_DOT[key]" />
              <span class="min-w-0 flex-1">
                <span class="text-muted-900 block text-[14.5px] font-semibold dark:text-white">{{ ROLES[key].label }}</span>
                <span class="text-muted-500 mt-[3px] block text-[12.5px] leading-[1.45]">{{ ROLES[key].covers }}</span>
              </span>
              <Icon v-if="invRole === key" name="lucide:check" class="text-primary-500 size-[17px] shrink-0" />
            </button>
          </div>

          <div v-if="invRole === 'owner'" class="mt-4 flex items-start gap-3 rounded-xl border border-[#EC6453]/35 bg-[#EC6453]/[0.08] p-4">
            <Icon name="lucide:alert-triangle" class="mt-px size-[18px] shrink-0 text-[#EC6453]" />
            <span class="text-muted-900 flex-1 text-[13px] leading-[1.6] dark:text-white">
              An owner can change platform settings, remove other owners and manage every client's money.
              Only invite an owner if that is what you intend — there {{ ownerCount === 1 ? 'is' : 'are' }} {{ ownerCount }} {{ ownerCount === 1 ? 'owner' : 'owners' }} today.
            </span>
          </div>

          <div class="text-muted-500 mt-[22px] text-[11px] font-bold uppercase tracking-[0.05em]">
            What this role can do
          </div>
          <div class="border-muted-200 bg-muted-50 mt-2.5 rounded-xl border px-4 dark:border-white/10 dark:bg-white/5">
            <div
              v-for="(perm, index) in PERMISSIONS"
              :key="perm.key"
              class="flex items-center gap-3 py-[11px]"
              :class="index < PERMISSIONS.length - 1 ? 'border-muted-200 border-b dark:border-white/5' : ''"
            >
              <Icon
                :name="perm.allow.includes(invRole) ? 'lucide:check' : 'lucide:minus'"
                class="size-3.5 shrink-0"
                :class="perm.allow.includes(invRole) ? 'text-[#22B07D]' : 'text-muted-400'"
                aria-hidden="true"
              />
              <span
                class="min-w-0 flex-1 text-[13.5px]"
                :class="perm.allow.includes(invRole) ? 'text-muted-900 dark:text-white' : 'text-muted-500'"
              >{{ perm.label }}</span>
              <span
                class="shrink-0 text-[12.5px] font-semibold"
                :class="perm.allow.includes(invRole) ? 'text-[#22B07D]' : 'text-muted-400'"
              >{{ perm.allow.includes(invRole) ? 'Yes' : 'No' }}</span>
            </div>
          </div>
        </div>

        <div class="border-muted-200 flex shrink-0 flex-wrap items-center gap-2.5 border-t px-6 py-4 dark:border-white/10">
          <span class="text-muted-500 min-w-0 flex-1 text-[12.5px]">Nothing is emailed — you'll get a link to pass on.</span>
          <button type="button" :class="GHOST_BTN" @click="inviteOpen = false">
            Cancel
          </button>
          <BaseButton rounded="lg" variant="primary" :disabled="!inviteReady || inviting" :loading="inviting" @click="confirmInvite">
            Create invite
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ======================= CHANGE ROLE MODAL ======================= -->
    <div v-if="roleOpen && editMember" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Change role">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="roleOpen = false" />
      <div class="apex-pop border-muted-200 dark:bg-muted-800 relative w-full max-w-[560px] overflow-hidden rounded-2xl border bg-white shadow-[0_40px_90px_rgba(0,0,0,.55)] dark:border-white/10">
        <div class="border-muted-200 border-b px-6 pb-4 pt-[22px] dark:border-white/10">
          <div class="font-heading text-muted-900 text-xl font-extrabold tracking-[-0.01em] dark:text-white">
            Change role
          </div>
          <p class="text-muted-600 dark:text-muted-300 mt-1.5 text-[13.5px]">
            {{ editMember.name }} · currently {{ ROLES[editMember.staffRole].label }}
          </p>
        </div>

        <div class="flex max-h-[340px] flex-col gap-0.5 overflow-y-auto p-3.5">
          <button
            v-for="key in STAFF_ROLES"
            :key="key"
            type="button"
            :aria-pressed="newRole === key"
            class="apex-focus flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-start transition-colors"
            :class="newRole === key ? 'bg-primary-500/12' : 'hover:bg-muted-100 dark:hover:bg-white/5'"
            @click="newRole = key"
          >
            <span aria-hidden="true" class="size-2.5 shrink-0 rounded-full" :class="ROLE_DOT[key]" />
            <span class="min-w-0 flex-1">
              <span class="text-muted-900 block text-[14.5px] font-semibold dark:text-white">{{ ROLES[key].label }}</span>
              <span class="text-muted-500 mt-[3px] block text-[12.5px] leading-[1.45]">{{ ROLES[key].covers }}</span>
            </span>
            <Icon v-if="newRole === key" name="lucide:check" class="text-primary-500 size-[17px] shrink-0" />
          </button>
        </div>

        <div v-if="lastOwnerBlock" class="mx-6 flex items-start gap-3 rounded-xl border border-[#EC6453]/35 bg-[#EC6453]/[0.08] p-4">
          <Icon name="lucide:alert-triangle" class="mt-px size-[18px] shrink-0 text-[#EC6453]" />
          <span class="text-muted-900 flex-1 text-[13px] leading-[1.6] dark:text-white">
            This is the last owner. Promote someone else to owner first — an account with no owner cannot manage platform settings or restore access.
          </span>
        </div>

        <div class="border-muted-200 mt-3.5 flex flex-wrap items-center gap-2.5 border-t px-6 py-4 dark:border-white/10">
          <span class="text-muted-500 min-w-0 flex-1 text-[12.5px]">Takes effect on their next request.</span>
          <button type="button" :class="GHOST_BTN" @click="roleOpen = false">
            Cancel
          </button>
          <BaseButton
            rounded="lg"
            variant="primary"
            :disabled="lastOwnerBlock || savingRole || newRole === editMember.staffRole"
            :loading="savingRole"
            @click="confirmRoleChange"
          >
            Save role
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- ==================== SUSPEND / RESTORE MODAL ==================== -->
    <div
      v-if="suspendOpen && suspendTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="suspendRestoring ? 'Restore access' : 'Suspend access'"
    >
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="suspendOpen = false" />
      <div class="apex-pop border-muted-200 dark:bg-muted-800 relative w-full max-w-[480px] rounded-2xl border bg-white p-6 shadow-[0_40px_90px_rgba(0,0,0,.55)] dark:border-white/10">
        <span
          aria-hidden="true"
          class="mb-4 flex size-11 items-center justify-center rounded-xl"
          :class="suspendRestoring ? 'bg-[#22B07D]/14 text-[#22B07D]' : 'bg-[#EC6453]/14 text-[#EC6453]'"
        >
          <Icon :name="suspendRestoring ? 'lucide:lock-open' : 'lucide:lock'" class="size-5" />
        </span>
        <div class="font-heading text-muted-900 text-[19px] font-extrabold tracking-[-0.01em] dark:text-white">
          {{ suspendRestoring ? 'Restore' : 'Suspend' }} {{ suspendTarget.name }}'s access?
        </div>
        <p class="text-muted-600 dark:text-muted-300 mt-2 text-[13.5px] leading-[1.6]">
          <template v-if="suspendRestoring">
            They will be able to sign in again with their existing password, as {{ ROLES[suspendTarget.staffRole].label }}.
          </template>
          <template v-else>
            They are refused at sign-in from their next request. Projects they manage keep their name on them, and nothing they have already done is undone.
          </template>
        </p>

        <div v-if="!suspendRestoring" class="mt-4">
          <label for="suspend-reason" class="text-muted-900 mb-2 block text-[13px] font-semibold dark:text-white">
            Reason <span class="text-muted-500 font-normal">— recorded in the audit log</span>
          </label>
          <textarea
            id="suspend-reason"
            v-model="suspendReason"
            rows="3"
            maxlength="500"
            placeholder="Why is this access being withdrawn?"
            class="border-muted-200 text-muted-900 placeholder:text-muted-400 focus:border-primary-400 dark:placeholder:text-muted-500 w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-sm leading-[1.55] outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" :class="GHOST_BTN" @click="suspendOpen = false">
            Cancel
          </button>
          <BaseButton
            rounded="lg"
            variant="primary"
            :disabled="savingSuspend || (!suspendRestoring && !suspendReason.trim())"
            :loading="savingSuspend"
            @click="confirmSuspend"
          >
            {{ suspendRestoring ? 'Restore access' : 'Suspend access' }}
          </BaseButton>
        </div>
        <!-- A disabled button must say why it is disabled (Phase 5 §4). -->
        <p v-if="!suspendRestoring && !suspendReason.trim()" class="text-muted-500 mt-3 text-end text-xs">
          Add a reason to continue.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Plain keyframes rather than a Vue <Transition>: a leave transition here
 * animated to opacity 0 without unmounting the node, leaving an invisible
 * full-screen overlay that swallowed every click (MEMORY.md, "Wallet
 * redesign — gotcha to remember").
 */
@keyframes apex-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes apex-pop {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.apex-fade {
  animation: apex-fade 0.2s ease-out both;
}
.apex-pop {
  animation: apex-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .apex-fade,
  .apex-pop {
    animation: none;
  }
}
</style>
