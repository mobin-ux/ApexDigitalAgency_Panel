<script setup lang="ts">
import type { ApexGlyphKind } from '~/utils/panel'

/**
 * The dashboard promo's illustration (Panel v2): a plan card filling its
 * instalment dots, orbiting service glyphs, the "one big invoice" being struck
 * through and a toast for the next payment.
 *
 * Decorative and labelled as such by the caller (`role="img"` + a sentence).
 * Every figure in it comes from the catalogue plan the customer has picked,
 * and the dates are an example cycle, not their account. The tick stops under
 * `prefers-reduced-motion` and while the tab is hidden.
 */
const props = defineProps<{
  kind: ApexGlyphKind
  service: string
  plan: string
  monthly: number
  payments: number
  deposit: number
  fixed: boolean
  liveText: string
  wide: boolean
}>()

const { formatCurrency } = useCurrency()
const tick = ref(4)
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  timer = setInterval(() => {
    if (!document.hidden) {
      tick.value += 1
    }
  }, 900)
})
onBeforeUnmount(() => clearInterval(timer))

const view = computed(() => {
  const n = props.payments
  const paid = Math.min(n, tick.value % (n + 3))
  const done = paid >= n
  const total = props.fixed ? props.deposit + n * props.monthly : n * props.monthly
  const paidAmt = props.fixed ? (paid === 0 ? props.deposit : props.deposit + paid * props.monthly) : paid * props.monthly
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + 1 + Math.min(paid, n - 1), 1)
  const nextDate = `01/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return {
    n,
    paid,
    done,
    pct: Math.round(paidAmt / total * 100),
    paidLabel: done ? `All ${n} paid` : `${paid} of ${n} paid`,
    amounts: `${formatCurrency(paidAmt)} of ${formatCurrency(total)}`,
    bigLabel: props.fixed ? 'One big invoice' : 'A 12-month contract',
    bigValue: props.fixed ? formatCurrency(total) : '12 months',
    becomes: props.fixed ? `becomes ${n} small ones` : `becomes ${n}, then rolling`,
    toastTitle: done ? (props.fixed ? 'Paid off. It is yours.' : 'Minimum term done') : `Payment ${paid + 1} · ${formatCurrency(props.monthly)}`,
    toastSub: done ? (props.fixed ? 'Code, files and domain handed over' : 'Rolling monthly from here') : `Due ${nextDate} · no interest`,
  }
})

const NODES: ApexGlyphKind[] = ['web', 'seo', 'mkt', 'brand']
const nodes = computed(() => NODES.map((k, i) => {
  const ang = (i * 90 + 30) * Math.PI / 180
  const rad = props.wide ? 205 : 160
  return { k, on: k === props.kind, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad }
}))
const SPARKS = [['12%', '18%'], ['82%', '22%'], ['16%', '82%'], ['88%', '76%'], ['52%', '6%']]
</script>

<template>
  <!-- Fixed colours on purpose: this sits on the navy promo band in both themes. -->
  <div class="pointer-events-none absolute inset-0 font-sans" aria-hidden="true">
    <div class="absolute left-1/2 top-1/2" :class="wide ? '-ml-[150px] -mt-[150px] size-[300px]' : '-ml-[120px] -mt-[120px] size-[240px]'">
      <div class="size-full rounded-full bg-[radial-gradient(circle_at_50%_38%,#9B79F6_0%,#7D53F2_55%,#6C40E8_100%)] shadow-[0_24px_80px_rgba(125,83,242,.45)] motion-safe:animate-[apexBreathe_7s_ease-in-out_infinite]" />
    </div>
    <div
      class="absolute left-1/2 top-1/2 rounded-full border border-dashed border-white/[.16] motion-safe:animate-[apexSpin_48s_linear_infinite]"
      :class="wide ? '-ml-[205px] -mt-[205px] size-[410px]' : '-ml-[160px] -mt-[160px] size-[320px]'"
    >
      <div class="absolute left-1/2 top-1/2 size-0">
        <span v-for="n in nodes" :key="n.k" class="absolute -ml-[22px] -mt-[22px] size-11" :style="{ transform: `translate(${n.x}px, ${n.y}px)` }">
          <span
            class="flex size-11 items-center justify-center rounded-[14px] border transition-[background,box-shadow] duration-300 motion-safe:animate-[apexSpinRev_48s_linear_infinite]"
            :class="n.on ? 'border-white bg-white shadow-[0_12px_28px_rgba(125,83,242,.45)] [--glyph-soft:#C9B8FB] [--glyph-strong:#7D53F2]' : 'border-white/[.14] bg-white/[.07] [--glyph-soft:rgba(155,121,246,.45)] [--glyph-strong:#9B79F6]'"
          >
            <ApexGlyph :kind="n.k" :size="22" />
          </span>
        </span>
      </div>
    </div>
    <span
      v-for="(s, i) in SPARKS"
      :key="i"
      class="absolute size-1.5 rounded-full bg-[#C9B8FB] motion-safe:animate-[apexSpark_3s_ease-in-out_infinite]"
      :style="{ left: s[0], top: s[1], animationDuration: `${2.4 + i * 0.5}s`, animationDelay: `${i * 0.4}s` }"
    />

    <!-- The plan card -->
    <div
      class="absolute left-1/2 top-1/2 flex flex-col gap-3.5 rounded-3xl border border-[#EDEFF1] bg-white p-5 shadow-[0_34px_72px_rgba(0,0,0,.35)] motion-safe:animate-[apexFloatA_7s_ease-in-out_infinite]"
      :class="wide ? '-ml-[150px] -mt-[106px] w-[300px]' : '-ml-[135px] -mt-[120px] w-[270px]'"
    >
      <div class="flex items-center gap-2.5">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#F1ECFE] [--glyph-soft:#C9B8FB] [--glyph-strong:#7D53F2]">
          <ApexGlyph :kind="kind" :size="22" />
        </span>
        <span class="flex min-w-0 grow flex-col gap-px">
          <span class="font-heading text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#101828]">{{ service }}</span>
          <span class="text-xs text-[#5C646B]">{{ plan }} plan</span>
        </span>
        <span class="shrink-0 rounded-full bg-[rgba(34,176,125,.10)] px-[9px] py-1 text-[11px] font-bold text-[#137050]">0% interest</span>
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="font-heading text-[44px] font-extrabold leading-none tracking-[-0.03em] text-[#101828] tabular-nums">{{ formatCurrency(monthly) }}</span>
        <span class="text-sm font-semibold text-[#5C646B]">/mo</span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="i in view.n"
          :key="`${i}-${i <= view.paid}`"
          class="block size-[13px] rounded-full"
          :class="[
            i <= view.paid ? 'bg-[#7D53F2] motion-safe:animate-[apexDotPop_420ms_cubic-bezier(.22,.61,.36,1)_both]' : 'bg-[#E4DCFD]',
            i === view.paid + 1 && !view.done ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_#7D53F2] motion-safe:animate-[apexPulse_1.2s_ease-out_infinite]' : '',
          ]"
        />
      </div>
      <div class="flex flex-col gap-[7px]">
        <div class="h-1.5 overflow-hidden rounded-full bg-[#EDEFF1]">
          <div class="h-full rounded-full transition-[width,background] duration-500" :class="view.done ? 'bg-[#22B07D]' : 'bg-[#7D53F2]'" :style="{ width: `${view.pct}%` }" />
        </div>
        <div class="flex justify-between gap-2.5 text-xs text-[#5C646B] tabular-nums">
          <span>{{ view.paidLabel }}</span>
          <span class="font-bold text-[#101828]">{{ view.amounts }}</span>
        </div>
      </div>
    </div>

    <div v-if="wide" class="absolute left-0 top-0 flex w-[176px] flex-col gap-1.5 rounded-[18px] border border-[#EDEFF1] bg-white px-4 py-3.5 shadow-[0_34px_72px_rgba(0,0,0,.35)] motion-safe:animate-[apexFloatB_8s_ease-in-out_infinite]">
      <span class="text-[11.5px] text-[#5C646B]">{{ view.bigLabel }}</span>
      <span class="font-heading relative self-start text-[22px] font-extrabold tracking-[-0.02em] text-[rgba(16,24,40,.38)] tabular-nums">
        {{ view.bigValue }}
        <span class="absolute -inset-x-[3px] top-[52%] h-[2.5px] origin-left rounded-[2px] bg-[#7D53F2] motion-safe:animate-[apexStrike_5s_cubic-bezier(.22,.61,.36,1)_infinite]" />
      </span>
      <span class="text-[11.5px] font-semibold text-[#7D53F2]">{{ view.becomes }}</span>
    </div>

    <div
      :key="view.done ? 'done' : 'next'"
      class="absolute flex items-center gap-2.5 rounded-full border border-[#EDEFF1] bg-white py-2.5 pl-2.5 pr-4 shadow-[0_34px_72px_rgba(0,0,0,.35)] motion-safe:animate-[apexToastIn_420ms_cubic-bezier(.22,.61,.36,1)_both]"
      :class="wide ? 'bottom-[6%] right-0' : 'bottom-[2%] right-[2%]'"
    >
      <span class="flex size-[26px] shrink-0 items-center justify-center rounded-full text-xs text-white" :class="view.done ? 'bg-[#22B07D]' : 'bg-[#7D53F2]'">{{ view.done ? '✓' : '£' }}</span>
      <span class="flex flex-col gap-px">
        <span class="whitespace-nowrap text-[13px] font-bold text-[#101828]">{{ view.toastTitle }}</span>
        <span class="whitespace-nowrap text-[11.5px] text-[#5C646B]">{{ view.toastSub }}</span>
      </span>
    </div>

    <div v-if="wide" class="absolute right-[2%] top-[6%] flex items-center gap-2 whitespace-nowrap rounded-full border border-white/[.14] bg-white/[.08] px-3.5 py-[9px] text-[12.5px] font-semibold text-white motion-safe:animate-[apexFloatC_6s_ease-in-out_infinite]">
      <span class="size-[7px] rounded-full bg-[#22B07D]" />{{ liveText }}
    </div>
  </div>
</template>
