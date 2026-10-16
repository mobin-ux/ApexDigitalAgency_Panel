<script setup lang="ts">
import { ourWorkVoices as voices } from '~/data/our-work'

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2)
}
</script>

<template>
  <section
    aria-labelledby="voices-title"
    class="border-y border-line bg-subtle"
  >
    <div class="container-page flex flex-col gap-12 py-20 lg:py-26">
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end lg:gap-16">
        <div class="flex flex-col gap-4">
          <UiEyebrowChip>{{ voices.eyebrow }}</UiEyebrowChip>
          <h2
            id="voices-title"
            class="max-w-[20ch] font-display text-h2 text-heading"
          >
            {{ voices.title }}
          </h2>
        </div>
        <p class="text-[1.03125rem] leading-[1.62] text-body lg:mb-1.5">
          {{ voices.intro }}
        </p>
      </div>

      <ul class="grid gap-6 md:grid-cols-2">
        <li
          v-for="item in voices.quotes"
          :key="item.name"
        >
          <figure class="flex h-full flex-col gap-6 rounded-2xl border border-line bg-white p-7 shadow-tile sm:p-9">
            <UiStars
              :size="15"
              :gap="3"
              class="text-amber-500"
            />
            <blockquote class="font-display text-[clamp(1.1875rem,1.05rem+0.45vw,1.375rem)] leading-[1.35] font-semibold tracking-[-0.018em] text-pretty text-heading">
              <p>{{ item.quote }}</p>
            </blockquote>
            <figcaption class="mt-auto flex flex-wrap items-center gap-3.5 border-t border-line-soft pt-5">
              <span
                class="inline-flex size-11 flex-none items-center justify-center rounded-full bg-violet-50 font-display text-[0.9375rem] font-bold text-violet-600"
                aria-hidden="true"
              >{{ initials(item.name) }}</span>
              <span class="flex flex-col gap-0.5">
                <span class="text-[0.9375rem] font-semibold text-heading">{{ item.name }}</span>
                <span class="text-[0.84375rem] text-muted">{{ item.role }}</span>
              </span>
              <span class="rounded-full bg-success-50 px-3 py-1.25 text-[0.78125rem] font-bold text-success-ink sm:ml-auto">{{ item.result }}</span>
            </figcaption>
          </figure>
        </li>
      </ul>

      <div class="flex flex-col gap-5 pt-2 lg:flex-row lg:items-center lg:gap-12">
        <p class="flex-none text-[0.8125rem] font-semibold text-muted">
          Also trusted by
        </p>
        <ul class="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between">
          <li
            v-for="client in voices.alsoTrustedBy"
            :key="client"
            class="font-display text-[1.375rem] font-bold tracking-[-0.02em] text-muted"
          >
            {{ client }}
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
