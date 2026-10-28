<script setup lang="ts">
/**
 * A media reference control: shows the chosen file (thumbnail, name, size),
 * opens the library in a dialog to pick another, takes the alt text the
 * document should use for it, and clears. Uploading happens on the Media
 * screen, so a picker never half-uploads into a draft.
 */
const props = defineProps<{
  modelValue: { mediaId: string, alt: string } | null
  accept?: 'image' | 'pdf'
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: { mediaId: string, alt: string } | null] }>()

const open = ref(false)
const search = ref('')
const debounced = ref('')
watchDebounced(search, (v) => {
  debounced.value = v.trim()
}, { debounce: 250 })

const { data: chosen } = useAsyncData(`media-picker-${props.modelValue?.mediaId ?? 'none'}`, () => (props.modelValue?.mediaId ? $fetch<any>(`/api/admin/website/media/${props.modelValue.mediaId}`).catch(() => null) : Promise.resolve(null)), { watch: [() => props.modelValue?.mediaId] })

const query = computed(() => ({ pageSize: 48, ...(debounced.value ? { q: debounced.value } : {}), ...(props.accept ? { kind: props.accept } : {}) }))
const { data: library, pending } = useFetch('/api/admin/website/media', { query, immediate: false, watch: [query], key: `media-picker-list-${props.accept ?? 'all'}` })
watch(open, (v) => {
  if (v && !library.value) {
    // Loaded on first open, not with the page.
    refreshNuxtData(`media-picker-list-${props.accept ?? 'all'}`)
  }
})

function pick(m: { id: string, alt: string }) {
  emit('update:modelValue', { mediaId: m.id, alt: props.modelValue?.alt || m.alt || '' })
  open.value = false
}
function setAlt(alt: string) {
  if (props.modelValue) {
    emit('update:modelValue', { ...props.modelValue, alt })
  }
}
function clear() {
  emit('update:modelValue', null)
}
function fmtBytes(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="border-muted-200 flex items-center gap-3 rounded-xl border p-3 dark:border-white/10">
      <span class="bg-muted-100 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg dark:bg-white/5">
        <img v-if="chosen?.mime?.startsWith('image/')" :src="chosen.src" :alt="chosen.alt" class="size-full object-cover">
        <Icon v-else-if="chosen" name="lucide:file-text" class="text-muted-400 size-6" />
        <Icon v-else name="lucide:image" class="text-muted-400 size-6" />
      </span>
      <span class="min-w-0 flex-1">
        <span v-if="chosen" class="text-muted-900 block truncate text-sm font-semibold dark:text-white">{{ chosen.filename }}</span>
        <span v-else-if="modelValue?.mediaId" class="text-[#EC6453] block text-sm font-semibold">File not found in the library</span>
        <span v-else class="text-muted-500 block text-sm">No file chosen</span>
        <span v-if="chosen" class="text-muted-500 block text-xs">{{ fmtBytes(chosen.bytes) }}<template v-if="chosen.width"> · {{ chosen.width }}×{{ chosen.height }}</template></span>
      </span>
      <BaseButton size="sm" rounded="lg" variant="muted" :disabled="disabled" @click="open = true">
        {{ modelValue ? 'Change' : 'Choose' }}
      </BaseButton>
      <BaseButton v-if="modelValue" size="sm" rounded="lg" variant="muted" :disabled="disabled" aria-label="Remove file" @click="clear">
        <Icon name="lucide:x" class="size-4" />
      </BaseButton>
    </div>
    <div v-if="modelValue && accept !== 'pdf'">
      <label class="text-muted-500 mb-1 block text-xs font-semibold">Alt text for this use</label>
      <input :value="modelValue.alt" maxlength="300" :disabled="disabled" placeholder="What the picture shows here" :class="INPUT" @input="setAlt(($event.target as HTMLInputElement).value)">
    </div>

    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Choose a file">
      <div class="apex-fade absolute inset-0 bg-black/60 backdrop-blur-sm" @click="open = false" />
      <div class="apex-pop relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border border-muted-200 bg-white shadow-[0_30px_60px_rgba(0,0,0,.5)] dark:border-white/10 dark:bg-muted-800">
        <div class="border-muted-200 flex items-center gap-3 border-b px-5 py-4 dark:border-white/10">
          <input v-model="search" type="search" placeholder="Search the library" :class="INPUT" class="max-w-xs" aria-label="Search the library">
          <span class="grow" />
          <NuxtLink to="/admin/website/media" class="apex-focus text-primary-500 dark:text-primary-400 rounded text-[12.5px] font-semibold hover:underline">
            Upload on the Media screen
          </NuxtLink>
          <button type="button" class="apex-focus text-muted-500 hover:text-muted-900 dark:hover:text-white rounded-lg p-1" aria-label="Close" @click="open = false">
            <Icon name="lucide:x" class="size-5" />
          </button>
        </div>
        <div class="overflow-y-auto p-5">
          <p v-if="pending" class="text-muted-500 text-sm">
            Loading…
          </p>
          <p v-else-if="!library?.items?.length" class="text-muted-500 text-sm">
            Nothing in the library matches. Upload files on the Media screen first.
          </p>
          <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" role="list">
            <li v-for="m in library.items" :key="m.id">
              <button type="button" class="apex-focus border-muted-200 hover:border-primary-400 flex w-full flex-col overflow-hidden rounded-xl border text-start dark:border-white/10" @click="pick(m)">
                <span class="bg-muted-100 flex aspect-[4/3] items-center justify-center overflow-hidden dark:bg-white/5">
                  <img v-if="m.mime.startsWith('image/')" :src="m.src" :alt="m.alt" loading="lazy" class="size-full object-cover">
                  <Icon v-else name="lucide:file-text" class="text-muted-400 size-8" />
                </span>
                <span class="text-muted-900 truncate px-2.5 py-2 text-[12px] font-semibold dark:text-white">{{ m.filename }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
