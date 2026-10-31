<script setup lang="ts">
import type { Permission } from '~~/shared/permissions'
import { rolesWith } from '~~/shared/permissions'

/**
 * The blocked screen (`Admin Console.dc.html`): "<Area> needs <roles>", why
 * it is not shown, what the signed-in role does cover, and a way back. The
 * roles come from `shared/permissions.ts`, the table the API's 403 names,
 * so the wall and the server explain a refusal with the same words.
 */
const { permission, title, body } = defineProps<{
  permission: Permission
  title?: string
  body?: string
}>()

const { roleDef, role, PERMISSIONS } = useStaffAccess()
const { user } = useUser()

const allowed = computed(() => rolesWith(permission).map(r => r.label))
const allowedText = computed(() => {
  const a = allowed.value
  return a.length > 1 ? `${a.slice(0, -1).join(', ')} or ${a.at(-1)}` : a.join('')
})
const who = computed(() => [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' ') || user.value?.email || 'this account')
const covers = computed(() => PERMISSIONS.filter(p => role.value && p.allow.includes(role.value)).map(p => p.label))
</script>

<template>
  <div class="bg-card border-line-subtle mx-auto my-10 flex max-w-[620px] flex-col items-start gap-3.5 rounded-2xl border p-6 sm:my-24 sm:p-8">
    <span class="bg-accent-tint text-accent-ink inline-flex size-11 items-center justify-center rounded-xl">
      <Icon name="lucide:lock" class="size-5" />
    </span>
    <h1 class="font-heading text-fg-heading text-[22px] font-bold tracking-[-0.02em]">
      {{ title ?? `This area needs ${allowedText}` }}
    </h1>
    <p class="text-fg-body text-[14.5px] leading-[1.6]">
      {{ body ?? `You are signed in as ${who} (${roleDef?.label ?? 'staff'}). The server refuses this area for your role, so it is not shown. Ask an Owner or Admin if you need it.` }}
    </p>
    <div class="text-fg-muted mt-1.5 text-xs font-bold uppercase tracking-[0.05em]">
      Your role covers
    </div>
    <ul class="flex flex-wrap gap-1.5">
      <li v-for="c in covers" :key="c" class="bg-chip border-line-subtle text-fg-body rounded-full border px-2.5 py-[5px] text-[12.5px]">
        {{ c }}
      </li>
      <li v-if="!covers.length" class="text-fg-body text-[13px]">
        Nothing in the console yet.
      </li>
    </ul>
    <AdminButton to="/admin" class="mt-2">
      Back to overview
    </AdminButton>
  </div>
</template>
