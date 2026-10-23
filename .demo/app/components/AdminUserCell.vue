<script setup lang="ts">
/**
 * Identity cell for admin lists: avatar + display name + email.
 * Accepts the minimal user shape every admin list endpoint returns.
 */
const props = defineProps<{
  user: {
    id?: string
    // Null for an account registered with a phone number.
    email: string | null
    phone?: string | null
    firstName?: string | null
    lastName?: string | null
    avatar?: string | null
  }
  /** Hide the second (email) line when space is tight. */
  compact?: boolean
}>()

/** How the account signs in: its email, else the phone it registered with. */
const contact = computed(() => props.user.email || props.user.phone || '')

const displayName = computed(() => {
  const full = [props.user.firstName, props.user.lastName].filter(Boolean).join(' ').trim()
  return full || contact.value || 'Unnamed account'
})
</script>

<template>
  <div class="flex min-w-0 items-center gap-3">
    <BaseAvatar size="xs" :src="user.avatar || '/img/avatars/10.svg'" />
    <div class="min-w-0">
      <div class="truncate text-[13.5px] font-semibold text-white">
        {{ displayName }}
      </div>
      <div v-if="!compact && contact && displayName !== contact" class="truncate text-xs text-muted-500">
        {{ contact }}
      </div>
    </div>
  </div>
</template>
