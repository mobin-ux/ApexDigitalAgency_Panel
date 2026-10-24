<script setup lang="ts">
/** The signed-in customer's initials disc. Never a broken image: text only. */
const { size = 34 } = defineProps<{ size?: number }>()
const { user } = useUser()

const initials = computed(() => {
  const u = user.value as any
  const source = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || u?.phone || ''
  return source
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]!.toUpperCase())
    .join('') || 'A'
})
</script>

<template>
  <span
    aria-hidden="true"
    class="font-heading inline-flex shrink-0 items-center justify-center rounded-full bg-[#7D53F2] font-semibold text-white"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px` }"
  >{{ initials }}</span>
</template>
