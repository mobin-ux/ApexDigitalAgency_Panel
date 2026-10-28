<script setup lang="ts">
import { contactMethods } from '~/data/contact'

const page = useCmsContent('contact')
const contactSteps = computed(() => page.value.steps)

/**
 * The other ways in, beside the form, and what happens after a message
 * arrives. A method card appears only once its destination is real (see
 * `contactMethods`), so today it is email alone.
 */
</script>

<template>
  <aside
    aria-label="Other ways to reach us"
    class="flex flex-col gap-4 lg:sticky lg:top-26"
  >
    <a
      v-for="method in contactMethods"
      :key="method.label"
      :href="method.href"
      :target="method.external ? '_blank' : undefined"
      :rel="method.external ? 'noopener noreferrer' : undefined"
      class="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-line bg-white px-5.5 py-5 shadow-tile transition-[box-shadow,border-color] duration-200 hover:border-violet-150 hover:shadow-tile-hover"
    >
      <span
        class="inline-flex size-11 items-center justify-center rounded-[0.8125rem] bg-violet-50 font-display text-[0.9375rem] font-bold text-violet-600"
        aria-hidden="true"
      >{{ method.glyph }}</span>
      <span class="flex min-w-0 flex-col gap-0.75">
        <span class="text-xs font-bold tracking-[0.07em] text-muted uppercase">{{ method.label }}</span>
        <span class="text-base font-semibold break-words text-heading">{{ method.value }}</span>
        <span class="text-[0.8125rem] text-muted">{{ method.note }}</span>
      </span>
      <span
        class="text-base text-violet-500 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
        aria-hidden="true"
      >{{ method.external ? '↗' : '→' }}</span>
      <span
        v-if="method.external"
        class="sr-only"
      > (opens in a new tab)</span>
    </a>

    <section
      aria-labelledby="contact-steps-title"
      class="relative flex flex-col gap-4.5 overflow-hidden rounded-[1.375rem] bg-ink-900 px-6.5 pt-6.5 pb-6"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_100%_at_100%_0%,rgb(125_83_242/0.26),transparent_60%)]"
        aria-hidden="true"
      />
      <h2
        id="contact-steps-title"
        class="relative text-xs font-bold tracking-[0.07em] text-violet-400 uppercase"
      >
        {{ contactSteps.label }}
      </h2>
      <ol class="relative flex flex-col gap-4.5">
        <li
          v-for="(step, i) in contactSteps.items"
          :key="step.title"
          class="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3.5"
        >
          <span
            class="inline-flex size-7 items-center justify-center rounded-full border border-white/14 bg-white/8 text-[0.78125rem] font-bold text-white"
            aria-hidden="true"
          >{{ i + 1 }}</span>
          <span class="flex flex-col gap-0.75">
            <span class="text-[0.9375rem] font-semibold text-white">{{ step.title }}</span>
            <span class="text-[0.84375rem] leading-[1.55] text-body-on-dark">{{ step.body }}</span>
          </span>
        </li>
      </ol>
    </section>
  </aside>
</template>
