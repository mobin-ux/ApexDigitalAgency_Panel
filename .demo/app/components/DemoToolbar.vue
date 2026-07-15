<script setup lang="ts">
import { DemoPanelActivity, DemoPanelLanguage } from '#components'

const emits = defineEmits<{
  toggleMobileNav: []
}>()

const route = useRoute()
const isSearchOpen = useSearchOpen()
const { open } = usePanels()

const { t, locale } = useI18n()
</script>

<template>
  <div class="relative z-10 mb-6">
    <div class="w-full flex items-center gap-4 min-h-14">
      <div class="flex min-w-0 items-center gap-x-5">
        <button
          type="button"
          class="flex xl:hidden items-center"
          @click="emits('toggleMobileNav')"
        >
          <span class="flex flex-col gap-1.5">
            <span class="block w-4 h-0.5 bg-muted-500" />
            <span class="block w-5 h-0.5 bg-muted-500" />
          </span>
        </button>
        <nav aria-label="Breadcrumb" class="min-w-0">
          <ol class="flex min-w-0 items-center gap-1.5 text-sm">
            <!-- Hide the parent crumb on the narrowest phones so the current page never gets squeezed by the toolbar's icon cluster. -->
            <li class="hidden text-muted-400 dark:text-muted-500 min-[400px]:block">
              Account
            </li>
            <li aria-hidden="true" class="hidden text-muted-300 dark:text-muted-600 min-[400px]:block">
              /
            </li>
            <li aria-current="page" class="truncate font-medium text-muted-900 dark:text-white">
              {{ route.meta.title }}
            </li>
          </ol>
        </nav>
      </div>
      <span aria-hidden="true" class="hidden md:block w-px self-stretch shrink-0 bg-muted-200 dark:bg-muted-800" />
      <div class="flex items-center justify-end gap-x-3 ms-auto">
        <button
          type="button"
          class="border-muted-200 hover:ring-muted-200 dark:hover:ring-muted-700 dark:border-muted-700 dark:bg-muted-950 dark:ring-offset-muted-900 flex md:hidden size-8 items-center justify-center rounded-full border bg-white ring-1 ring-transparent transition-all duration-300 hover:ring-offset-4"
          aria-label="Search"
          @click="isSearchOpen = true"
        >
          <Icon name="lucide:search" class="text-muted-400 size-4" />
        </button>
        <button
          type="button"
          class="border-muted-200 hover:ring-muted-200 dark:hover:ring-muted-700 dark:border-muted-700 dark:bg-muted-800 dark:ring-offset-muted-900 flex size-8 items-center justify-center rounded-full border bg-white ring-1 ring-transparent transition-all duration-300 hover:ring-offset-4"
          @click="open(DemoPanelLanguage)"
        >
          <img
            class="size-6 rounded-full"
            :src="getLocaleFlag(locale)"
            alt="flag icon"
          >
        </button>
        <button
          type="button"
          class="border-muted-200 hover:ring-muted-200 dark:hover:ring-muted-700 dark:border-muted-700 dark:bg-muted-950 dark:ring-offset-muted-900 flex size-8 items-center justify-center rounded-full border bg-white ring-1 ring-transparent transition-all duration-300 hover:ring-offset-4"
          @click="open(DemoPanelActivity)"
        >
          <Icon name="solar:widget-2-outline" class="text-muted-400 size-4" />
        </button>
        <div
          role="button"
          class="cursor-pointer h-8 min-w-36 hidden md:flex items-center justify-between bg-white dark:bg-muted-950 text-muted-400 hover:text-muted-600 dark:hover:text-muted-200 hover:ring-muted-300 dark:hover:ring-muted-700 gap-2 ps-3 pe-1 py-1 rounded-md ring-1 ring-muted-200 dark:ring-muted-800 transition-colors duration-300"
          @click="isSearchOpen = true"
        >
          <div class="pointer-events-none">
            <span class="font-sans text-sm">
              {{ t('components.toolbar.search') }}
            </span>
          </div>
          <div class="flex gap-1">
            <BaseKbd
              size="sm"
              variant="default"
              class="!font-semibold h-6!"
            >
              Ctrl
            </BaseKbd>
            <BaseKbd
              size="sm"
              variant="default"
              class="!px-2 !font-semibold h-6!"
            >
              K
            </BaseKbd>
          </div>
        </div>
        <BaseDropdown
          variant="default"
          :bindings="{
            content: {
              align: 'end',
              sideOffset: 10,
            },
          }"
        >
          <template #button>
            <button
              type="button"
            >
              <BaseChip size="sm" color="custom" :offset="3" class="text-success-500">
                <img
                  src="/img/avatars/10.svg"
                  class="size-8 rounded-full object-cover"
                >
              </BaseChip>
            </button>
          </template>
          <BaseDropdownItem>{{ t('components.toolbar.actions.leads') }}</BaseDropdownItem>
          <BaseDropdownItem>{{ t('components.toolbar.actions.projects') }}</BaseDropdownItem>
          <BaseDropdownItem>{{ t('components.toolbar.actions.team') }}</BaseDropdownItem>
          <BaseDropdownItem>{{ t('components.toolbar.actions.reports') }}</BaseDropdownItem>
          <BaseDropdownItem>
            {{ t('components.toolbar.actions.settings') }}
            <template #end>
              <BaseKbd size="sm">
                <span class="text-xs font-mono">⌘</span>
              </BaseKbd>
              <BaseKbd size="sm">
                <span class="text-xs font-mono px-0.5">P</span>
              </BaseKbd>
            </template>
          </BaseDropdownItem>
        </BaseDropdown>
      </div>
    </div>
    <div class="mt-5 border-b border-muted-200 dark:border-muted-800" />
  </div>
</template>
