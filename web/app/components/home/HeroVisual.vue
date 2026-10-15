<script setup lang="ts">
/**
 * Decorative product composition beside the hero copy: a browser window with
 * an example enquiries chart, a team card and a "live in 4–6 weeks" pill.
 * It illustrates the offer rather than reporting this visitor's data, so the
 * whole block is hidden from assistive tech and from small screens, where the
 * copy and calls to action should own the first viewport.
 */
const bars = [
  { h: 'h-5.25', tone: 'bg-violet-100' },
  { h: 'h-6.75', tone: 'bg-violet-100' },
  { h: 'h-6', tone: 'bg-violet-100' },
  { h: 'h-8.75', tone: 'bg-violet-400' },
  { h: 'h-11.25', tone: 'bg-violet-400' },
  { h: 'h-14', tone: 'bg-violet-500' },
  { h: 'h-17.5', tone: 'bg-violet-500' },
] as const

const delays = ['[animation-delay:0ms]', '[animation-delay:80ms]', '[animation-delay:160ms]', '[animation-delay:240ms]', '[animation-delay:320ms]', '[animation-delay:400ms]', '[animation-delay:480ms]'] as const

const team = [
  { initials: 'AK', tone: 'bg-violet-500' },
  { initials: 'JM', tone: 'bg-heading' },
  { initials: 'RB', tone: 'bg-violet-400' },
  { initials: 'SD', tone: 'bg-success' },
] as const
</script>

<template>
  <div
    class="relative mx-auto hidden h-140 w-120 sm:block"
    aria-hidden="true"
  >
    <div class="absolute top-10 left-24 size-90 rounded-full bg-[radial-gradient(circle_at_50%_38%,var(--color-violet-400)_0%,var(--color-violet-500)_55%,var(--color-violet-600)_100%)] shadow-blob" />

    <!-- Browser window -->
    <div class="absolute top-2 left-15.5 w-99 overflow-hidden rounded-2xl border border-line bg-white shadow-float motion-safe:animate-float-a">
      <div class="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        <span class="flex gap-1.25">
          <span class="block size-2 rounded-full bg-line-strong" />
          <span class="block size-2 rounded-full bg-line-strong" />
          <span class="block size-2 rounded-full bg-line-strong" />
        </span>
        <span class="flex-1 rounded-full bg-subtle px-3 py-1.25 text-[0.71875rem] text-muted">yourbusiness.co.uk</span>
      </div>

      <div class="flex flex-col gap-4.5 p-5.5">
        <div class="flex items-center gap-2">
          <span class="block h-2 w-5.5 rounded-[3px] bg-heading" />
          <span class="ml-auto flex items-center gap-1.75">
            <span class="block h-1.5 w-6.5 rounded-[3px] bg-line" />
            <span class="block h-1.5 w-6.5 rounded-[3px] bg-line" />
            <span class="block h-3.5 w-8.5 rounded-full bg-violet-500" />
          </span>
        </div>
        <div class="grid grid-cols-[1fr_96px] items-center gap-4">
          <div class="flex flex-col gap-2">
            <span class="block h-3.25 w-[92%] rounded-sm bg-heading" />
            <span class="block h-3.25 w-[64%] rounded-sm bg-heading" />
            <span class="mt-1 block h-1.5 w-[84%] rounded-[3px] bg-line" />
            <span class="block h-1.5 w-[70%] rounded-[3px] bg-line" />
            <span class="mt-1.5 block h-5.5 w-19.5 rounded-[7px] bg-violet-500" />
          </div>
          <span class="block h-24 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600" />
        </div>
        <div class="grid grid-cols-3 gap-2.5">
          <span class="block h-11 rounded-sm bg-chip" />
          <span class="block h-11 rounded-sm bg-chip" />
          <span class="block h-11 rounded-sm bg-chip" />
        </div>
      </div>

      <div class="flex items-end gap-5 border-t border-line px-5.5 pt-4 pb-5">
        <div class="flex flex-col gap-1.5">
          <span class="text-xs text-muted">Enquiries this month</span>
          <span class="font-display text-[1.625rem] leading-none font-extrabold tracking-tight text-heading">128</span>
          <span class="inline-flex self-start rounded-full bg-success/10 px-2.25 py-0.75 text-[0.6875rem] font-bold text-success-ink">↑ 214%</span>
        </div>
        <div class="ml-auto flex h-17.5 items-end gap-1.75">
          <span
            v-for="(bar, i) in bars"
            :key="i"
            class="w-2.5 origin-bottom rounded-[3px] motion-safe:animate-grow"
            :class="[bar.h, bar.tone, delays[i]]"
          />
        </div>
      </div>
    </div>

    <!-- Team card -->
    <div class="absolute bottom-6 -left-11.5 flex w-66 flex-col gap-3 rounded-2xl border border-line bg-white px-5 py-4.5 shadow-float motion-safe:animate-float-b">
      <div class="flex items-center gap-2.5">
        <span class="font-display text-[0.90625rem] font-semibold tracking-tight text-heading">Your Apex team</span>
        <span class="ml-auto inline-flex items-center gap-1.5 text-[0.6875rem] font-bold text-success-ink">
          <span class="block size-1.5 rounded-full bg-success" />
          Working today
        </span>
      </div>
      <div class="flex items-center">
        <span
          v-for="(person, i) in team"
          :key="person.initials"
          class="relative inline-flex size-10 items-center justify-center rounded-full border-[2.5px] border-white font-display text-xs font-semibold tracking-wide text-white"
          :class="[person.tone, i > 0 && '-ml-3']"
        >{{ person.initials }}</span>
      </div>
      <span class="text-[0.71875rem] leading-normal text-muted">Designers, developers, SEO and ads — all in-house in Kent.</span>
    </div>

    <!-- Lead-time pill -->
    <div class="absolute top-0 right-1.5 flex items-center gap-2.5 rounded-full border border-line bg-white px-4.5 py-2.75 shadow-menu motion-safe:animate-float-c">
      <span class="inline-flex size-5 items-center justify-center rounded-full bg-success text-[0.625rem] text-white">✓</span>
      <span class="text-[0.84375rem] font-semibold text-heading">Live in 4–6 weeks</span>
    </div>
  </div>
</template>
