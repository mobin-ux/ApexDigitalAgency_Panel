<script setup lang="ts">
import type { Permission } from '~~/shared/permissions'
import { rolesWith } from '~~/shared/permissions'

/**
 * What a staff member sees where their role cannot go (Phase 9 Admin,
 * badges 3 and 9).
 *
 * A bare 403 tells someone the product is broken. This names the roles
 * that do hold the permission and restates what their own role covers,
 * so the next step is obvious — ask one of those people — rather than a
 * support ticket about an error page.
 */
const { permission, title, body } = defineProps<{
  permission: Permission
  title: string
  body: string
}>()

const { roleDef } = useStaffAccess()
const allowed = computed(() => rolesWith(permission))
</script>

<template>
  <div class="max-w-[560px] rounded-2xl border border-muted-200 bg-white p-7 dark:border-white/10 dark:bg-muted-800">
    <span class="flex size-12 items-center justify-center rounded-xl bg-muted-100 text-muted-500 dark:bg-white/5 dark:text-muted-400">
      <Icon name="lucide:lock" class="size-6" />
    </span>
    <h1 class="font-heading mt-[18px] text-[21px] font-extrabold tracking-[-0.01em] text-muted-900 dark:text-white">
      {{ title }}
    </h1>
    <p class="mt-2.5 text-sm leading-[1.65] text-muted-600 dark:text-muted-300">
      {{ body }}
    </p>
    <div class="mt-[18px] flex flex-wrap gap-2">
      <span
        v-for="r in allowed"
        :key="r.key"
        class="bg-primary-500/14 text-primary-600 dark:text-primary-200 inline-flex items-center rounded-full px-3 py-[7px] text-[12.5px] font-bold"
      >{{ r.label }}</span>
    </div>
    <p v-if="roleDef" class="mt-[18px] text-[13px] leading-[1.6] text-muted-500">
      Your role, {{ roleDef.label }}, covers {{ roleDef.covers }}.
    </p>
  </div>
</template>
