<script setup lang="ts">
/**
 * Wallet Page - Final Integration
 * Layout: Bento Grid (Unified)
 * Sections:
 * 1. Top Stats (User Provided Code)
 * 2. Installments (User Provided Code - Fixed Logic)
 * 3. Right Sidebar: Card & Activity (User Provided Code)
 */

definePageMeta({
  title: 'Financial Command',
  layout: 'default',
  middleware: [],
  auth: false,
})

// --- UTILS (Defined locally to prevent template errors) ---
function formatCurrency(val: number) {
  return `$${new Intl.NumberFormat('en-US').format(Math.abs(val))}`
}

// Logic to pre-calculate block styles (Fixes the Tailwind crash)
function getBlockClass(i: number, paid: number, current: number) {
  if (i <= paid)
    return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
  if (i === paid + 1)
    return 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.4)]'
  return 'bg-white/10'
}

// --- 1. CORE DATA ---
const balanceOverview = {
  cash: 11400.00,
  credits: 1143.00,
  monthlyChange: 12.5,
}

const creditLimit = {
  utilization: 17,
}

// --- 2. INSTALLMENTS ---
// We pre-calculate the blocks array here to avoid logic in HTML
const rawInstallments = [
  {
    id: 'INS-8854',
    project: 'E-Commerce Redesign',
    total: 3600,
    paid: 900,
    amountDue: 300,
    monthsTotal: 12,
    monthsPaid: 3,
    nextDue: 'Feb 01',
    icon: 'lucide:monitor',
    status: 'active',
  },
  {
    id: 'INS-9921',
    project: 'Office Hardware Loan',
    total: 2400,
    paid: 2000,
    amountDue: 400,
    monthsTotal: 6,
    monthsPaid: 5,
    nextDue: 'Jan 15',
    icon: 'lucide:server',
    status: 'urgent',
  },
]

// Transform data to include style classes safely
const activeInstallments = rawInstallments.map(plan => ({
  ...plan,
  // Generate an array of classes for the progress blocks
  blocks: Array.from({ length: plan.monthsTotal }, (_, i) =>
    getBlockClass(i + 1, plan.monthsPaid, plan.monthsPaid + 1)),
}))

// --- 3. ACTIVITY & REQUESTS ---
const activeTab = ref('Activity')
const tabs = ['Activity', 'Requests']

const activities = [
  { id: 1, title: 'Deposit', sub: 'Stripe Top-up', date: '10:23 AM', amount: 2000.00, type: 'in', icon: 'lucide:arrow-down-left' },
  { id: 2, title: 'Server Costs', sub: 'Auto-pay', date: 'Yesterday', amount: -50.00, type: 'out', icon: 'lucide:server' },
  { id: 3, title: 'Ad Credits', sub: 'Promo', date: 'Jun 10', amount: 120.00, type: 'credit', icon: 'lucide:zap' },
]

const requests = [
  { id: 101, title: 'Withdrawal #992', date: 'Pending', amount: 500.00, status: 'Processing', icon: 'lucide:banknote' },
]

// --- 4. CARDS ---
const cardLimits = [
  { label: 'Withdrawal limit', current: 950, max: 2500, icon: 'lucide:arrow-up-from-line' },
  { label: 'Payment limit', current: 231.12, max: 5000, icon: 'lucide:credit-card' },
]
</script>

<template>
  <div class="w-full min-h-screen bg-[#0f111a] font-sans text-muted-100 p-4 md:p-6 lg:p-8 relative overflow-x-hidden">
    <div class="fixed inset-0 pointer-events-none -z-10">
      <div class="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-[120px]" />
      <div class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px]" />
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 brightness-100 contrast-150" />
    </div>

    <div class="max-w-[1600px] mx-auto relative z-10">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl md:text-3xl font-light text-white">
            Financial <span class="font-bold text-primary-400">Command</span>
          </h1>
        </div>
        <div class="flex gap-2">
          <button class="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 text-white transition-all">
            <Icon name="lucide:bell" class="w-5 h-5" />
          </button>
          <button class="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 text-white transition-all">
            <Icon name="lucide:settings" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div class="lg:col-span-8 flex flex-col gap-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="relative bg-[#161925] border border-white/5 rounded-3xl p-6 overflow-hidden group">
              <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />

              <div class="flex justify-between items-start mb-6">
                <div class="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
                  <Icon name="lucide:wallet" class="w-6 h-6" />
                </div>
                <div class="text-right">
                  <span class="text-[10px] uppercase font-bold text-muted-500 block">Available Cash</span>
                  <span class="text-2xl font-mono font-bold text-white">{{ formatCurrency(balanceOverview.cash) }}</span>
                </div>
              </div>

              <div class="flex items-center gap-2 text-xs text-muted-400 bg-white/5 p-3 rounded-xl border border-white/5">
                <Icon name="lucide:trending-up" class="w-4 h-4 text-emerald-400" />
                <span class="text-emerald-400 font-bold">+{{ balanceOverview.monthlyChange }}%</span>
                <span>increase this month</span>
              </div>
            </div>

            <div class="relative bg-[#161925] border border-white/5 rounded-3xl p-6 overflow-hidden group">
              <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all" />

              <div class="flex justify-between items-start mb-6">
                <div class="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
                  <Icon name="lucide:zap" class="w-6 h-6" />
                </div>
                <div class="text-right">
                  <span class="text-[10px] uppercase font-bold text-muted-500 block">Ad Credits</span>
                  <span class="text-2xl font-mono font-bold text-white">{{ formatCurrency(balanceOverview.credits) }}</span>
                </div>
              </div>

              <div class="space-y-1.5">
                <div class="flex justify-between text-[10px] uppercase font-bold text-muted-500">
                  <span>Utilization</span>
                  <span>{{ creditLimit.utilization }}%</span>
                </div>
                <div class="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-500 rounded-full" :style="{ width: `${creditLimit.utilization}%` }" />
                </div>
              </div>
            </div>
          </div>

          <div class="bg-[#161925] border border-white/5 rounded-[2rem] p-6 lg:p-8 flex flex-col relative overflow-hidden">
            <div class="flex items-center justify-between mb-6 relative z-10">
              <div>
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                  Project Installments
                  <span class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] uppercase border border-amber-500/20">2 Active</span>
                </h3>
                <p class="text-xs text-muted-500 mt-1">
                  Linked to your active orders
                </p>
              </div>
              <button class="text-xs text-primary-400 hover:text-white transition-colors uppercase font-bold">
                Details
              </button>
            </div>

            <div class="space-y-4 relative z-10">
              <div
                v-for="plan in activeInstallments" :key="plan.id"
                class="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.04] transition-all"
              >
                <div class="flex flex-col md:flex-row gap-6 items-center">
                  <div class="flex items-center gap-4 w-full md:w-auto md:min-w-[200px]">
                    <div class="w-12 h-12 rounded-xl bg-[#0f111a] border border-white/10 flex items-center justify-center text-muted-400 group-hover:text-white group-hover:border-primary-500/50 transition-all">
                      <Icon :name="plan.icon" class="w-6 h-6" />
                    </div>
                    <div>
                      <span class="text-[10px] text-muted-500 font-mono block mb-0.5">{{ plan.id }}</span>
                      <h4 class="text-sm font-bold text-white">
                        {{ plan.project }}
                      </h4>
                    </div>
                  </div>

                  <div class="flex-1 w-full">
                    <div class="flex justify-between text-[10px] uppercase font-bold text-muted-500 mb-2">
                      <span>Progress: {{ plan.monthsPaid }}/{{ plan.monthsTotal }} Months</span>
                      <span :class="plan.status === 'urgent' ? 'text-amber-400' : 'text-emerald-400'">
                        Next: {{ formatCurrency(plan.amountDue) }} on {{ plan.nextDue }}
                      </span>
                    </div>
                    <div class="flex gap-1 h-3 w-full">
                      <div
                        v-for="(blockClass, idx) in plan.blocks" :key="idx"
                        class="flex-1 rounded-sm transition-all duration-500"
                        :class="blockClass"
                      />
                    </div>
                  </div>

                  <button class="shrink-0 px-4 py-2 rounded-lg bg-white/5 hover:bg-white text-white hover:text-black border border-white/10 text-xs font-bold uppercase transition-all">
                    Pay Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-4 w-full flex flex-col gap-6">
          <div class="bg-[#161925] border border-white/5 rounded-3xl p-6 sticky top-6">
            <div class="flex justify-between items-center mb-6">
              <h3 class="text-sm font-bold text-white uppercase tracking-wider">
                Your Cards
              </h3>
              <button class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors">
                <Icon name="lucide:settings-2" class="w-4 h-4" />
              </button>
            </div>

            <div class="relative w-full aspect-[1.586/1] rounded-2xl overflow-hidden p-6 flex flex-col justify-between shadow-2xl mb-8 group cursor-pointer transition-transform hover:scale-[1.02]">
              <div class="absolute inset-0 bg-gradient-to-br from-[#2c3e50] to-[#000000] z-0" />
              <div class="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 z-0" />

              <div class="relative z-10 flex justify-between items-start">
                <div class="text-xs font-bold text-white/50 tracking-widest uppercase">
                  Mastercard
                </div>
                <Icon name="logos:mastercard" class="w-8 h-8 opacity-80" />
              </div>
              <div class="relative z-10">
                <div class="text-lg font-mono font-bold text-white tracking-widest mb-1">
                  •••• •••• •••• 4479
                </div>
                <div class="flex justify-between items-end">
                  <div>
                    <div class="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">
                      Card Holder
                    </div>
                    <div class="text-xs font-bold text-white uppercase tracking-wide">
                      Kendra Wilson
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">
                      Expires
                    </div>
                    <div class="text-xs font-bold text-white">
                      12/28
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex justify-between items-center pb-4 border-b border-white/5">
                <span class="text-2xl font-bold text-white font-mono">$9,543.13</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-500 font-mono">**** 4869</span>
                  <Icon name="logos:mastercard" class="w-5 h-5 opacity-70" />
                </div>
              </div>
              <div v-for="(limit, i) in cardLimits" :key="i" class="bg-white/5 border border-white/5 rounded-xl p-4">
                <div class="flex items-center gap-3 mb-3">
                  <div class="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center text-muted-400">
                    <Icon :name="limit.icon" class="w-4 h-4" />
                  </div>
                  <div class="flex-1">
                    <div class="flex justify-between items-baseline mb-1">
                      <h4 class="text-xs font-bold text-white">
                        {{ limit.label }}
                      </h4>
                      <span class="text-[10px] text-muted-400">{{ formatCurrency(limit.current) }} / {{ formatCurrency(limit.max) }}</span>
                    </div>
                    <div class="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                      <div class="h-full bg-primary-500 rounded-full" :style="{ width: `${(limit.current / limit.max) * 100}%` }" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-[#161925] border border-white/5 rounded-[2rem] p-6 flex flex-col h-[400px]">
            <div class="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
              <div class="flex bg-black/20 p-1 rounded-xl">
                <button
                  v-for="tab in tabs" :key="tab"
                  class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
                  :class="activeTab === tab ? 'bg-white text-black shadow-lg' : 'text-muted-500 hover:text-white'"
                  @click="activeTab = tab"
                >
                  {{ tab }}
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto custom-scrollbar pr-2">
              <div v-if="activeTab === 'Activity'" class="space-y-3">
                <div
                  v-for="item in activities" :key="item.id"
                  class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center border border-white/5"
                      :class="item.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : item.type === 'credit' ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-muted-400'"
                    >
                      <Icon :name="item.icon" class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="text-sm font-bold text-white">
                        {{ item.title }}
                      </h4>
                      <p class="text-[10px] text-muted-500">
                        {{ item.date }} • {{ item.sub }}
                      </p>
                    </div>
                  </div>
                  <span
                    class="text-xs font-mono font-bold"
                    :class="item.amount > 0 ? 'text-emerald-400' : 'text-white'"
                  >
                    {{ item.amount > 0 ? '+' : '' }}{{ formatCurrency(item.amount) }}
                  </span>
                </div>
              </div>

              <div v-if="activeTab === 'Requests'" class="space-y-3">
                <div
                  v-for="req in requests" :key="req.id"
                  class="p-4 rounded-xl bg-white/5 border border-white/5 relative overflow-hidden group"
                >
                  <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                      <Icon :name="req.icon" class="w-4 h-4 text-primary-400" />
                      <span class="text-xs font-bold text-white">{{ req.title }}</span>
                    </div>
                    <span
                      class="text-[10px] px-2 py-0.5 rounded border uppercase font-bold"
                      :class="req.status === 'Processing' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'"
                    >
                      {{ req.status }}
                    </span>
                  </div>
                  <div class="flex justify-between items-end">
                    <span class="text-[10px] text-muted-500">{{ req.date }}</span>
                    <span class="text-sm font-mono font-bold text-white">{{ formatCurrency(req.amount) }}</span>
                  </div>
                  <div v-if="req.status === 'Processing'" class="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500/20">
                    <div class="h-full bg-amber-500 w-1/2 animate-[shine_1.5s_infinite]" />
                  </div>
                </div>
                <button class="w-full py-3 border border-dashed border-white/10 rounded-xl text-xs font-bold text-muted-500 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-2">
                  <Icon name="lucide:plus" class="w-4 h-4" /> New Request
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

@keyframes shine {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}
</style>
