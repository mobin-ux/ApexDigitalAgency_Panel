<script setup lang="ts">
import type { AdminConfirmPoint } from '~/composables/useAdminConsole'

/**
 * The admin console's one confirmation dialog (`Admin Console.dc.html`):
 * a title, a sentence saying what happens, the consequences as ticked or
 * crossed points, and — where the action is audited — the reason that is
 * stored with it. Mounted once by the layout; screens call
 * `useAdminConfirm().ask()` and await the reason.
 *
 * Built on reka's Dialog like `AdminWebsiteDialog`, for the focus trap,
 * Escape, the scroll lock and focus return. Entry-only keyframes, never a
 * `<Transition>` leave (the Wallet gotcha).
 */
const { state, settle } = useAdminConfirm()
const reason = ref('')

const open = computed({
  get: () => Boolean(state.value),
  set: (value) => {
    if (!value) {
      settle(null)
    }
  },
})

watch(() => state.value, () => {
  reason.value = ''
})

const needsReason = computed(() => Boolean(state.value?.reason?.required) && reason.value.trim().length < 3)

const POINT: Record<AdminConfirmPoint['tone'], { icon: string, cls: string }> = {
  success: { icon: 'lucide:check', cls: 'text-[#22B07D]' },
  danger: { icon: 'lucide:x', cls: 'text-[#EC6453]' },
  warning: { icon: 'lucide:alert-triangle', cls: 'text-[#D9A521]' },
  info: { icon: 'lucide:info', cls: 'text-[#6EA8FE]' },
  accent: { icon: 'lucide:credit-card', cls: 'text-accent-ink' },
}

function confirm() {
  if (!state.value || needsReason.value) {
    return
  }
  settle(state.value.reason ? reason.value.trim() : '')
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="apex-scrim-in fixed inset-0 z-[80] bg-[rgba(3,10,12,.6)]" />
      <DialogContent
        v-if="state"
        class="apex-rise-in border-line-strong bg-card fixed left-1/2 top-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[18px] border shadow-[0_40px_90px_rgba(17,31,34,.4)] focus:outline-none"
        @submit.prevent
      >
        <div class="flex flex-col gap-2 px-6 pt-[22px]">
          <DialogTitle class="font-heading text-fg-heading text-xl font-extrabold tracking-[-0.015em]">
            {{ state.title }}
          </DialogTitle>
          <DialogDescription class="text-fg-body text-sm leading-[1.6]">
            {{ state.body }}
          </DialogDescription>
        </div>
        <ul v-if="state.points?.length" class="flex flex-col gap-2 px-6 pt-4">
          <li v-for="(p, i) in state.points" :key="i" class="text-fg-heading flex gap-2.5 text-[13.5px] leading-normal">
            <Icon :name="POINT[p.tone].icon" class="mt-0.5 size-4 shrink-0" :class="POINT[p.tone].cls" aria-hidden="true" />
            <span>{{ p.text }}</span>
          </li>
        </ul>
        <label v-if="state.reason" class="flex flex-col gap-[7px] px-6 pt-4">
          <span class="text-fg-heading text-[13px] font-semibold">
            {{ state.reason.label }}<span v-if="state.reason.required" class="text-[#EC6453]"> *</span>
          </span>
          <textarea
            v-model="reason"
            rows="3"
            :placeholder="state.reason.placeholder"
            :aria-required="state.reason.required"
            class="apex-ring border-line-rule bg-shell text-fg-heading resize-y rounded-xl border px-3 py-2.5 text-base leading-normal sm:text-sm"
          />
          <span v-if="state.reason.hint" class="text-fg-muted text-xs">{{ state.reason.hint }}</span>
        </label>
        <div class="flex flex-wrap justify-end gap-2.5 px-6 pb-[22px] pt-5">
          <AdminButton variant="light" size="lg" @click="settle(null)">
            Cancel
          </AdminButton>
          <AdminButton :variant="state.danger ? 'danger' : 'primary'" size="lg" :disabled="needsReason" @click="confirm">
            {{ state.confirmLabel }}
          </AdminButton>
        </div>
        <p v-if="needsReason && reason.length" class="sr-only" aria-live="polite">
          A reason of at least three characters is needed.
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
