<script setup lang="ts">
import { avatarPhoto } from '~~/shared/avatar'

/**
 * An account's disc: their profile photo when they have uploaded one
 * (Settings › Profile), otherwise their initials. Without `person` it is the
 * signed-in account. Never a broken image: a photo that fails to load falls
 * back to the initials, and old Tairo demo paths in `avatar` are ignored.
 */
const { size = 34, person } = defineProps<{
  size?: number
  person?: { firstName?: string | null, lastName?: string | null, email?: string | null, phone?: string | null, avatar?: string | null } | null
}>()
const { user } = useUser()
const who = computed(() => person ?? (user.value as any))

const initials = computed(() => {
  const u = who.value
  const source = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || u?.phone || ''
  return source
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]!.toUpperCase())
    .join('') || 'A'
})

const photo = computed(() => avatarPhoto(who.value?.avatar))
const failed = ref<string | null>(null)
</script>

<template>
  <img
    v-if="photo && failed !== photo"
    :src="photo"
    alt=""
    aria-hidden="true"
    class="max-w-none shrink-0 rounded-full object-cover"
    :style="{ width: `${size}px`, height: `${size}px` }"
    @error="failed = photo"
  >
  <span
    v-else
    aria-hidden="true"
    class="font-heading inline-flex shrink-0 items-center justify-center rounded-full bg-[#7D53F2] font-semibold text-white"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px` }"
  >{{ initials }}</span>
</template>
