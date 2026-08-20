<script setup lang="ts">
/**
 * The one shell for sign in, create account and password reset.
 *
 * Before Phase 8 these three pages had three different shells: login-1 was a
 * split screen with a Tairo illustration on the left, signup-2 a centred card
 * with `<TairoLogo>`, recover a third variant wrapped in `<ClientOnly>`. Each
 * repeated the whole chrome, so the pages drifted apart and none of them
 * carried Apex branding.
 *
 * Left: the brand panel — Apex mark, one positioning line, three benefits,
 * the client rating. Hidden below `lg`, where the form is the whole job and
 * the panel would push it under the fold.
 *
 * Right: the header (a way out, and the theme toggle) plus a 400px form
 * column. Pages supply only their form.
 */
const FEATURES = [
  'Live progress on every project',
  'Message your team in one thread',
  'Spread the cost at 0%',
]

/**
 * The marketing site, not `/dashboards`. That route is behind the `auth`
 * middleware, so from the sign-in page "Back to Home" ran the guard and
 * landed the visitor back on sign-in — the one escape route was a loop.
 * `/` is Tairo's demo landing page, so it is not the answer either.
 */
const MARKETING_URL = 'https://apexdigi.co.uk'
</script>

<template>
  <!--
    Field colours for the whole shell, set once as Shuriken's own input
    variables rather than as `!` overrides on each of the ten inputs across
    three pages. Written as `dark:` utilities, not scoped CSS: a
    `:global(.dark) .apex-auth` rule is silently dropped by the scoped-style
    compiler, and this is the form the Tairo page this replaced already used
    (`dark:[--color-input-default-bg:var(--color-muted-950)]`).

    Shuriken's dark defaults put the field on muted-900 (#0C1719) — a shade
    DARKER than the muted-950 page it sits on — outlined in muted-800, the
    colour it should have been filled with, with a muted-700 placeholder that
    is all but invisible. The Apex design system says a field is
    `--surface-card` on `--bg-page` behind a `--border-subtle` hairline, i.e. a
    raised surface: ink-800 (#16252A) and rgba(255,255,255,.08) in the dark
    scope, white and gray-200 in the light one.
  -->
  <div
    class="apex-auth dark:bg-muted-950 flex min-h-dvh bg-white font-sans
           [--color-field-label:var(--color-muted-900)]
           [--color-input-default-bg:var(--color-white)]
           [--color-input-default-border:var(--color-muted-200)]
           [--color-input-default-placeholder:var(--color-muted-400)]
           [--color-input-default-text:var(--color-muted-900)]
           [--apex-focus-inner:var(--color-white)]
           [--apex-focus-outer:var(--color-primary-500)]
           dark:[--apex-focus-inner:var(--color-muted-950)]
           dark:[--apex-focus-outer:var(--color-primary-400)]
           dark:[--color-field-label:var(--color-white)]
           dark:[--color-input-default-bg:var(--color-muted-800)]
           dark:[--color-input-default-border:color-mix(in_oklab,#fff_8%,transparent)]
           dark:[--color-input-default-placeholder:var(--color-muted-500)]
           dark:[--color-input-default-text:var(--color-white)]"
  >
    <!--
      The form side is a light/dark pair, the brand panel is not. login-1 used
      `bg-white` and signup/recover `bg-muted-100`, so a dark-only shell would
      have been a regression — and it would have left the theme toggle sitting
      on a page it visibly did nothing to. The panel keeps its designed dark
      gradient in both themes, the way a brand hero does.

      This comment lives INSIDE the root element on purpose: a comment as a
      sibling of the root makes the template multi-root, so the client
      hydrates a Fragment where the server rendered a plain element and Vue
      reports a hydration mismatch.
    -->

    <!-- ============================================================ BRAND -->
    <aside
      class="relative hidden w-[44%] shrink-0 flex-col overflow-hidden p-11 lg:flex"
      style="background: radial-gradient(120% 120% at 88% 8%, rgba(125,83,242,0.30) 0%, rgba(125,83,242,0) 55%), linear-gradient(160deg, #16252A 0%, #101D21 60%, #0C1719 100%);"
    >
      <div class="flex items-center gap-[11px]">
        <img src="/brand/apex-icon.svg" alt="" width="30" height="30" class="block size-[30px]">
        <span class="font-heading text-2xl font-extrabold tracking-[-0.02em] text-white">Apex</span>
      </div>

      <div class="flex flex-1 flex-col justify-center">
        <h2 class="font-heading text-4xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white">
          Your projects,<br><span class="text-primary-400">start to finish.</span>
        </h2>
        <p class="text-muted-400 mb-7 mt-[18px] max-w-[360px] text-[15px] leading-[1.6]">
          Track progress, message your team and spread the cost — all from one place.
        </p>
        <ul class="flex flex-col gap-[13px]">
          <li v-for="f in FEATURES" :key="f" class="flex items-center gap-[11px]">
            <span aria-hidden="true" class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#22B07D] text-white">
              <Icon name="lucide:check" class="size-3" />
            </span>
            <span class="text-sm text-white">{{ f }}</span>
          </li>
        </ul>
      </div>

      <div class="flex items-center gap-3 border-t border-white/8 pt-6">
        <div class="flex gap-0.5 text-[#22B07D]" aria-hidden="true">
          <Icon v-for="n in 5" :key="n" name="lucide:star" class="size-3.5 fill-current" />
        </div>
        <span class="text-muted-400 text-[12.5px]">Rated <strong class="font-semibold text-white">5.0</strong> by our clients</span>
      </div>
    </aside>

    <!-- ============================================================= FORM -->
    <div class="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <div class="flex shrink-0 items-center justify-between gap-4 px-6 pt-6 sm:px-10">
        <a
          :href="MARKETING_URL"
          class="apex-focus text-muted-400 hover:text-primary-400 inline-flex items-center gap-2 rounded text-[13.5px] font-medium transition-colors"
        >
          <Icon name="lucide:arrow-left" class="size-4" />
          <span>Back to apexdigi.co.uk</span>
        </a>
        <BaseThemeToggle />
      </div>

      <div class="flex flex-1 items-center justify-center px-6 pb-10 pt-8 sm:px-10">
        <div class="w-full max-w-[400px]">
          <!-- The brand mark travels with the form below `lg`, where the
               panel is hidden and the page would otherwise be unbranded. -->
          <div class="mb-8 flex items-center gap-[11px] lg:hidden">
            <img src="/brand/apex-icon.svg" alt="" width="28" height="28" class="block size-7">
            <span class="font-heading text-muted-900 text-xl font-extrabold tracking-[-0.02em] dark:text-white">Apex</span>
          </div>

          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * Label typography and input padding come from utility classes on the
 * component rather than from a variable, so they are the one thing the
 * custom properties above cannot reach. The design's label is 12.5px/600 with
 * 8px beneath it; Shuriken's is 14px/500 with none. Its input pads 12px; the
 * design pads 14px.
 */
.apex-auth :deep(label) {
  margin-bottom: 8px;
  font-size: 12.5px;
  font-weight: 600;
}

.apex-auth :deep(input) {
  padding-inline: 14px;
}

/*
 * Focus ring: the shell's `.apex-focus` treatment, applied to fields rendered
 * by `BaseInput` (which carries Shuriken's `nui-focus` instead). The design
 * asks for a 2px `--apex-violet-400` outline at 2px offset; expressing it as
 * the same double box-shadow the rest of the app uses keeps one focus
 * language across the product, and keeps the ring readable by laying the
 * inner band over the page colour rather than the field.
 */
.apex-auth :deep(input:focus-visible) {
  outline: none;
  box-shadow:
    0 0 0 2px var(--apex-focus-inner),
    0 0 0 4px var(--apex-focus-outer);
}
</style>
