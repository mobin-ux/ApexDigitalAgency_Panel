<script setup lang="ts">
/* eslint-disable vue/no-mutating-props -- the editor edits one document object in place; the page compares it with its saved copy to know it is dirty, and child controls write into the branch they were given (see AdminWebsiteFields) */
import type { LinkValue } from '~~/shared/cms'
import { PANEL_LINK_KEYS } from '~~/shared/cms'

/**
 * A link control: one of the three kinds the contract allows (a path on the
 * site, a named panel destination, an https address) and its value. The
 * stored object is replaced whole on every change so the kind and the value
 * can never disagree.
 */
const props = defineProps<{
  model: Record<string, unknown>
  field: string
  errors: Record<string, string[]>
  path: string
}>()

const PANEL_LABEL: Record<typeof PANEL_LINK_KEYS[number], string> = {
  login: 'Client login',
  signup: 'Create an account',
  dashboard: 'Client dashboard',
  newOrder: 'New order',
}

const link = computed<LinkValue>(() => {
  const value = props.model[props.field] as LinkValue | undefined
  return value && typeof value === 'object' && 'kind' in value ? value : { kind: 'internal', path: '/' }
})

function setKind(kind: LinkValue['kind']) {
  if (kind === link.value.kind) {
    return
  }
  props.model[props.field] = kind === 'internal' ? { kind, path: '/' } : kind === 'panel' ? { kind, key: 'signup' } : { kind, url: 'https://' }
}

function setValue(raw: string) {
  const current = link.value
  props.model[props.field] = current.kind === 'internal' ? { kind: 'internal', path: raw } : current.kind === 'panel' ? { kind: 'panel', key: raw as typeof PANEL_LINK_KEYS[number] } : { kind: 'external', url: raw }
}

const fieldErrors = computed(() => Object.entries(props.errors).filter(([key]) => key === props.path || key.startsWith(`${props.path}.`)).flatMap(([, list]) => list))

const INPUT = 'focus:border-primary-400 w-full rounded-xl border border-muted-200 bg-muted-50 px-3.5 py-2.5 text-sm text-muted-900 outline-none placeholder:text-muted-400 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-muted-500'
</script>

<template>
  <div class="flex flex-col gap-2 sm:flex-row">
    <BaseSelect :model-value="link.kind" rounded="lg" aria-label="Link kind" class="sm:w-44" @update:model-value="setKind($event as LinkValue['kind'])">
      <BaseSelectItem value="internal">
        Page on the site
      </BaseSelectItem>
      <BaseSelectItem value="panel">
        Customer panel
      </BaseSelectItem>
      <BaseSelectItem value="external">
        Another website
      </BaseSelectItem>
    </BaseSelect>
    <div class="min-w-0 flex-1">
      <BaseSelect v-if="link.kind === 'panel'" :model-value="link.key" rounded="lg" aria-label="Panel destination" @update:model-value="setValue($event as string)">
        <BaseSelectItem v-for="key in PANEL_LINK_KEYS" :key="key" :value="key">
          {{ PANEL_LABEL[key] }}
        </BaseSelectItem>
      </BaseSelect>
      <input
        v-else
        :value="link.kind === 'internal' ? link.path : link.url"
        :placeholder="link.kind === 'internal' ? '/services' : 'https://'"
        :aria-label="link.kind === 'internal' ? 'Path on the site' : 'Web address'"
        :aria-invalid="fieldErrors.length ? 'true' : undefined"
        :class="INPUT"
        class="font-mono"
        @input="setValue(($event.target as HTMLInputElement).value)"
      >
      <p v-for="e in fieldErrors" :key="e" class="mt-1.5 text-xs font-semibold text-[#EC6453]" role="alert">
        {{ e }}
      </p>
    </div>
  </div>
</template>
