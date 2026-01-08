<script setup lang="ts">
/**
 * Dashboard Home - Integrated & Optimized
 * ---------------------------------------
 * Components used:
 * - DemoWidgetFeatures (CTA)
 * - BaseCard, BaseHeading, BaseButton (Tairo Standard)
 * - Hobbies Style Grid for Services
 */

import { ref } from 'vue'

definePageMeta({
  title: 'Dashboard',
  layout: 'default',
  middleware: [],
  auth: false,
})

// --- STATE ---
const showFeatures = ref(true)

// --- DATA ---

// 1. Stats
const stats = [
  { label: 'Active Projects', value: '4', icon: 'lucide:layers', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { label: 'Available Credit', value: '$12,500', icon: 'lucide:credit-card', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { label: 'Cash Wallet', value: '$3,420', icon: 'lucide:wallet', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
]

// 2. Active Projects (List View)
// 2. Active Projects (Updated Data)
// 2. Active Projects (Updated Data)
const activeProjects = ref([
  {
    id: 1,
    name: 'E-Commerce Redesign',
    client: 'Gold Store Isfahan',
    status: 'In Progress',
    date: 'Due Jan 20',
    icon: 'lucide:shopping-bag',
  },
  {
    id: 2,
    name: 'Instagram Campaign',
    client: 'Apex Vision',
    status: 'Pending',
    date: 'Due Jan 15',
    icon: 'lucide:camera',
  },
  {
    id: 3,
    name: 'SEO Optimization',
    client: 'Tech Startup',
    status: 'Started',
    date: 'Due Feb 01',
    icon: 'lucide:search',
  },
])

// 3. Services (Adapted from Hobbies Dashboard Images)
// 3. Services Data (Optimized for New UI)
// 3. Services Data (Optimized for New UI)
const services = [
  {
    name: 'Digital Marketing',
    desc: 'Scale your business with zero upfront cost & profit sharing.',
    url: '/orders/new?service=marketing',
    icon: 'lucide:megaphone',
    color: 'text-pink-400',
    bgGradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
    lineColor: 'bg-pink-500',
  },
  {
    name: 'Web Development',
    desc: 'Custom high-performance websites using Nuxt & Tailwind.',
    url: '/orders/new?service=dev',
    icon: 'lucide:code-2',
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    lineColor: 'bg-cyan-500',
  },
  {
    name: 'SEO & Content',
    desc: 'Dominate search results and drive organic traffic.',
    url: '/orders/new?service=seo',
    icon: 'lucide:search',
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    lineColor: 'bg-amber-500',
  },
  {
    name: 'Branding Design',
    desc: 'Logo, Visual Identity and complete UI/UX solutions.',
    url: '/orders/new?service=design',
    icon: 'lucide:palette',
    color: 'text-purple-400',
    bgGradient: 'from-purple-500/20 via-indigo-500/10 to-transparent',
    lineColor: 'bg-purple-500',
  },
]
</script>

<template>
  <div class="w-full min-h-screen bg-[#0f111a] font-sans text-muted-100 p-4 md:p-6 lg:p-8 flex flex-col overflow-x-hidden relative">
    <div class="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div class="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[120px] mix-blend-screen" />
      <div class="absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] bg-indigo-600/5 rounded-full blur-[120px] mix-blend-screen" />
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150" />
    </div>

    <div class="max-w-[1400px] mx-auto w-full mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
      <div>
        <h1 class="text-3xl font-light text-white tracking-tight">
          Dashboard <span class="font-bold text-[#6366f1]">Overview</span>
        </h1>
        <p class="text-xs text-muted-500 mt-1.5 font-medium">
          Manage your projects, wallet, and services.
        </p>
      </div>
      <div class="hidden md:flex gap-3">
        <button class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#161925] border border-white/10 hover:bg-white/5 text-muted-400 hover:text-white text-xs font-bold uppercase transition-all">
          <Icon name="lucide:history" class="w-4 h-4" /> History
        </button>
      </div>
    </div>

    <div class="max-w-[1400px] mx-auto w-full space-y-10 relative z-10">
      <Transition
        enter-active-class="transition-all duration-500 ease-out-back"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-4 scale-95"
      >
        <div v-if="showFeatures" class="w-full relative z-20">
          <div class="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#161925] shadow-2xl group">
            <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen translate-x-1/3 -translate-y-1/3 group-hover:bg-indigo-500/30 transition-colors duration-700" />
            <div class="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] mix-blend-screen -translate-x-1/3 translate-y-1/3" />
            <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay" />

            <div class="absolute right-4 top-4 z-30">
              <button
                class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 flex items-center justify-center text-muted-400 hover:text-white transition-all duration-300 backdrop-blur-md"
                @click="showFeatures = false"
              >
                <Icon name="lucide:x" class="size-4" />
              </button>
            </div>

            <div class="relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 md:p-12 items-center">
              <div class="lg:col-span-7 space-y-6">
                <div class="flex flex-wrap items-center gap-3">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                    <Icon name="lucide:flame" class="size-3" /> Hot Offer
                  </span>
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-muted-400 text-[10px] font-bold uppercase tracking-widest">
                    <Icon name="lucide:clock" class="size-3" /> Limited Spots Available
                  </span>
                </div>

                <div>
                  <h2 class="text-3xl md:text-5xl font-black text-white leading-tight tracking-tight mb-4">
                    Scale Your Business, <br>
                    <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Pay From Profits.</span>
                  </h2>
                  <p class="text-base md:text-lg text-muted-400 max-w-xl leading-relaxed">
                    Don't let cash flow stop your growth. Use our <strong>Zero Upfront Payment</strong> plan for Digital Marketing & SEO services. We invest in you, you split the win.
                  </p>
                </div>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                  <NuxtLink to="/orders/new" class="relative group/btn overflow-hidden rounded-2xl bg-white px-8 py-4 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
                    <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover/btn:opacity-10 transition-opacity duration-300" />
                    <span class="relative flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#0f111a]">
                      Get Started Now <Icon name="lucide:arrow-right" class="size-4 transition-transform group-hover/btn:translate-x-1" />
                    </span>
                  </NuxtLink>
                  <button class="px-6 py-4 rounded-2xl text-white text-sm font-bold hover:text-indigo-300 transition-colors flex items-center gap-2">
                    <Icon name="lucide:play-circle" class="size-5" /> How it works?
                  </button>
                </div>
                <p class="text-[10px] text-muted-500 font-medium">
                  * No credit card required for application.
                </p>
              </div>

              <div class="lg:col-span-5 relative hidden lg:block">
                <div class="relative w-full h-[300px] perspective-1000">
                  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-[#1a1d2d]/90 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl transform rotate-[-6deg] hover:rotate-0 transition-transform duration-500 z-20 group-hover:scale-105">
                    <div class="flex justify-between items-center mb-4">
                      <div class="flex flex-col">
                        <span class="text-[10px] text-muted-400 uppercase font-bold">Revenue Growth</span>
                        <span class="text-xl font-bold text-white">+145%</span>
                      </div>
                      <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Icon name="lucide:trending-up" class="size-4" />
                      </div>
                    </div>
                    <div class="flex items-end gap-1 h-16 w-full">
                      <div class="w-1/5 bg-indigo-500/20 rounded-t-sm h-[30%]" />
                      <div class="w-1/5 bg-indigo-500/40 rounded-t-sm h-[50%]" />
                      <div class="w-1/5 bg-indigo-500/60 rounded-t-sm h-[40%]" />
                      <div class="w-1/5 bg-indigo-500/80 rounded-t-sm h-[70%]" />
                      <div class="w-1/5 bg-indigo-500 rounded-t-sm h-[100%] animate-pulse" />
                    </div>
                  </div>
                  <div class="absolute top-1/2 left-1/2 -translate-x-[30%] -translate-y-[70%] w-48 bg-[#202436]/80 backdrop-blur-md border border-white/5 p-4 rounded-2xl shadow-xl transform rotate-[12deg] z-10 animate-float">
                    <div class="flex items-center gap-3">
                      <div class="p-2 rounded-lg bg-pink-500/20 text-pink-400">
                        <Icon name="lucide:megaphone" class="size-5" />
                      </div>
                      <div>
                        <p class="text-xs font-bold text-white">
                          Ads Campaign
                        </p>
                        <p class="text-[10px] text-muted-400">
                          Active
                        </p>
                      </div>
                    </div>
                  </div>
                  <div class="absolute bottom-0 right-10 p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30 animate-bounce-slow z-30">
                    <Icon name="lucide:rocket" class="size-8 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style="animation-delay: 0.1s;">
        <div class="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#161925] p-6 group hover:border-orange-500/30 transition-all duration-300">
          <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl group-hover:bg-orange-500/20 transition-all" />
          <div class="relative z-10 flex flex-col h-full justify-between">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">
                  <Icon name="lucide:layers" class="size-5" />
                </div>
                <span class="text-xs font-bold uppercase tracking-wider text-muted-400">Projects</span>
              </div>
              <span v-if="stats[0].value > 0" class="flex size-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
            </div>
            <div v-if="stats[0].value > 0">
              <div class="flex items-end gap-2 mb-2">
                <h3 class="text-3xl font-black text-white">
                  {{ stats[0].value }}
                </h3>
                <span class="text-xs text-muted-500 mb-1.5 font-medium">Active Now</span>
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between text-[9px] text-muted-400 uppercase font-bold">
                  <span>Progress</span>
                  <span class="text-orange-400">2 Needs Review</span>
                </div>
                <div class="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                  <div class="h-full w-[65%] rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />
                </div>
              </div>
            </div>
            <div v-else class="text-center py-2">
              <h3 class="text-lg font-bold text-white mb-1">
                No Active Projects
              </h3>
              <p class="text-[10px] text-muted-500 mb-3 line-clamp-1">
                Start your first campaign today.
              </p>
              <button class="w-full py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase hover:bg-orange-500 hover:text-white transition-all">
                + Create Project
              </button>
            </div>
          </div>
        </div>

        <div class="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#161925] p-6 group hover:border-emerald-500/30 transition-all duration-300">
          <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div class="relative z-10 flex flex-col h-full justify-between">
            <div class="flex items-start justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Icon name="lucide:credit-card" class="size-5" />
                </div>
                <span class="text-xs font-bold uppercase tracking-wider text-muted-400">Credit Limit</span>
              </div>
              <Icon name="lucide:arrow-up-right" class="size-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <div class="flex items-end gap-2 mb-2">
                <h3 class="text-3xl font-black text-white">
                  $12,500
                </h3>
                <span class="text-xs text-emerald-400 mb-1.5 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Approved</span>
              </div>
              <p class="text-[10px] text-muted-500 font-medium flex items-center gap-1">
                <Icon name="lucide:check-circle" class="size-3 text-muted-600" />
                <span>Zero interest for next 30 days</span>
              </p>
            </div>
            <div class="absolute inset-x-4 bottom-4 translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <button class="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-lg">
                Increase Limit
              </button>
            </div>
          </div>
        </div>

        <div class="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#161925] p-6 group hover:border-indigo-500/30 transition-all duration-300">
          <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all" />
          <div class="relative z-10 flex flex-col h-full justify-between">
            <div class="flex items-start justify-between mb-2">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Icon name="lucide:wallet" class="size-5" />
                </div>
                <span class="text-xs font-bold uppercase tracking-wider text-muted-400">Wallet</span>
              </div>
            </div>
            <div class="mb-4">
              <h3 class="text-3xl font-black text-white flex items-center gap-2">
                $3,420
                <span class="text-[10px] font-normal text-muted-500 bg-white/5 px-2 py-1 rounded-full">USD</span>
              </h3>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <button class="flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-white text-[10px] font-bold uppercase transition-all">
                <Icon name="lucide:plus" class="size-3 text-indigo-400" /> Deposit
              </button>
              <button class="flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 text-white text-[10px] font-bold uppercase transition-all">
                <Icon name="lucide:arrow-up-right" class="size-3 text-muted-400" /> Send
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in" style="animation-delay: 0.2s;">
        <div class="col-span-12 lg:col-span-5 flex flex-col gap-6">
          <div class="flex items-center justify-between px-1">
            <BaseHeading as="h3" size="lg" weight="medium" class="text-muted-800 dark:text-white flex items-center gap-2">
              <Icon name="lucide:folder-open" class="size-5 text-primary-500" />
              Active Projects
            </BaseHeading>
            <NuxtLink v-if="activeProjects.length > 0" to="/projects" class="group flex items-center gap-1 text-xs font-bold text-primary-500 transition-colors hover:text-primary-400">
              View All <Icon name="lucide:arrow-right" class="size-3 transition-transform group-hover:translate-x-1" />
            </NuxtLink>
          </div>

          <div v-if="activeProjects.length > 0" class="space-y-4">
            <div
              v-for="project in activeProjects" :key="project.id"
              class="group relative overflow-hidden rounded-2xl bg-[#161925] border border-white/5 p-4 transition-all duration-300 hover:border-primary-500/30 hover:bg-[#1a1d29] hover:shadow-lg hover:shadow-primary-500/5"
            >
              <div class="flex items-start gap-4">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-400 ring-1 ring-white/10 transition-all duration-300 group-hover:bg-primary-500/10 group-hover:text-primary-400 group-hover:ring-primary-500/20">
                  <Icon :name="project.icon" class="size-6" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between">
                    <div>
                      <h4 class="truncate font-sans text-sm font-bold text-white transition-colors group-hover:text-primary-400">
                        {{ project.name }}
                      </h4>
                      <p class="text-xs text-muted-500">
                        {{ project.client }}
                      </p>
                    </div>
                    <span
                      class="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide border"
                      :class="project.status === 'In Progress' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : project.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'"
                    >
                      {{ project.status }}
                    </span>
                  </div>
                  <div class="mt-3 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-2 text-[10px] text-muted-400">
                      <Icon name="lucide:calendar-clock" class="size-3" />
                      <span>{{ project.date }}</span>
                    </div>
                    <div v-if="project.status === 'In Progress'" class="flex w-24 items-center gap-2">
                      <div class="h-1.5 w-full rounded-full bg-white/5">
                        <div class="h-full w-[65%] rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="absolute inset-y-0 right-0 flex w-16 translate-x-full items-center justify-center bg-gradient-to-l from-[#161925] to-transparent transition-transform duration-300 group-hover:translate-x-0">
                <button class="flex size-8 items-center justify-center rounded-lg bg-primary-500 text-white shadow-lg hover:bg-primary-400">
                  <Icon name="lucide:chevron-right" class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-white/10 bg-[#161925]/50 p-8 text-center transition-all hover:border-primary-500/20 hover:bg-[#161925]">
            <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
              <Icon name="lucide:folder-plus" class="size-8 text-muted-500" />
            </div>
            <h4 class="text-lg font-bold text-white">
              No Active Projects
            </h4>
            <p class="mb-6 max-w-[200px] text-xs text-muted-500">
              Your workspace is empty. Start a new project to track your growth.
            </p>
            <BaseButton to="/orders/new" color="primary" flavor="outline" rounded="lg" class="w-full sm:w-auto border-primary-500/30 hover:bg-primary-500/10">
              <Icon name="lucide:plus" class="mr-2 size-4" /> Start Project
            </BaseButton>
          </div>

          <BaseCard class="relative overflow-hidden border-none bg-gradient-to-br from-muted-900 to-muted-800 p-6 text-white shadow-xl">
            <div class="relative z-10 flex items-center justify-between">
              <div>
                <p class="text-xs font-medium text-muted-400">
                  Total Spent
                </p>
                <p class="mt-1 text-3xl font-black tracking-tight text-white">
                  $8,240
                </p>
                <span class="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <Icon name="lucide:trending-up" class="size-3" /> +12% this month
                </span>
              </div>
              <div class="relative size-16">
                <svg class="size-full -rotate-90" viewBox="0 0 36 36">
                  <path class="text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" />
                  <path class="text-primary-500 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" stroke-dasharray="75, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <Icon name="lucide:dollar-sign" class="size-6 text-white" />
                </div>
              </div>
            </div>
            <div class="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary-500/10 blur-2xl" />
          </BaseCard>
        </div>

        <div class="col-span-12 lg:col-span-7 flex flex-col gap-8">
          <div class="flex flex-col justify-between md:flex-row md:items-center">
            <div>
              <BaseHeading as="h2" size="xl" weight="medium" lead="tight" class="text-muted-900 dark:text-white">
                <span>Explore Services</span>
              </BaseHeading>
              <BaseParagraph size="sm">
                <span class="text-muted-600 dark:text-muted-400">
                  Grow your business with our professional solutions
                </span>
              </BaseParagraph>
            </div>
            <div class="mt-4 md:mt-0">
              <BaseButton rounded="lg" color="primary" flavor="outline" to="/services">
                <span>View All Catalog</span>
              </BaseButton>
            </div>
          </div>

          <div>
            <div class="mb-4">
              <BaseHeading as="h2" size="lg" weight="medium" lead="tight" class="text-muted-900 dark:text-white">
                <span>Trending Now</span>
              </BaseHeading>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NuxtLink to="/orders/new?service=marketing" class="group relative flex w-full flex-col overflow-hidden rounded-2xl h-64 shadow-lg transition-transform hover:-translate-y-1">
                <img
                  class="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
                  src="https://images.unsplash.com/photo-1557838923-2985c318be48?auto=format&fit=crop&w=600&q=80"
                  alt="Digital Marketing"
                >
                <div class="bg-gradient-to-t from-black/90 via-black/50 to-transparent absolute inset-0 z-10 size-full transition-opacity duration-300" />

                <div class="absolute inset-0 z-20 flex size-full flex-col justify-between p-6">
                  <div class="flex items-center justify-between">
                    <span class="rounded-full bg-pink-500/20 px-3 py-1 text-[10px] font-bold text-pink-300 border border-pink-500/30 backdrop-blur-md">HOT</span>
                    <div class="size-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <Icon name="lucide:megaphone" class="size-4 text-white" />
                    </div>
                  </div>

                  <div>
                    <h3 class="font-sans text-xl font-bold text-white mb-1">
                      Digital Marketing
                    </h3>
                    <div class="flex items-center justify-between">
                      <p class="text-xs text-gray-300">
                        Zero upfront cost • ROI Focused
                      </p>
                      <BaseButton rounded="lg" size="icon-sm" variant="muted" class="bg-white/20 hover:bg-white text-white hover:text-black border-none transition-colors">
                        <Icon name="lucide:arrow-right" class="size-4" />
                      </BaseButton>
                    </div>
                  </div>
                </div>
              </NuxtLink>

              <NuxtLink to="/orders/new?service=dev" class="group relative flex w-full flex-col overflow-hidden rounded-2xl h-64 shadow-lg transition-transform hover:-translate-y-1">
                <img
                  class="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-110"
                  src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=600&q=80"
                  alt="Web Development"
                >
                <div class="bg-gradient-to-t from-black/90 via-black/50 to-transparent absolute inset-0 z-10 size-full transition-opacity duration-300" />

                <div class="absolute inset-0 z-20 flex size-full flex-col justify-between p-6">
                  <div class="flex items-center justify-between">
                    <span class="rounded-full bg-cyan-500/20 px-3 py-1 text-[10px] font-bold text-cyan-300 border border-cyan-500/30 backdrop-blur-md">NEW</span>
                    <div class="size-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                      <Icon name="lucide:code-2" class="size-4 text-white" />
                    </div>
                  </div>

                  <div>
                    <h3 class="font-sans text-xl font-bold text-white mb-1">
                      Web Development
                    </h3>
                    <div class="flex items-center justify-between">
                      <p class="text-xs text-gray-300">
                        Modern Stack • High Performance
                      </p>
                      <BaseButton rounded="lg" size="icon-sm" variant="muted" class="bg-white/20 hover:bg-white text-white hover:text-black border-none transition-colors">
                        <Icon name="lucide:arrow-right" class="size-4" />
                      </BaseButton>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>

          <div>
            <div class="mb-4">
              <BaseHeading as="h2" size="lg" weight="medium" lead="tight" class="text-muted-900 dark:text-white">
                <span>Popular Solutions</span>
              </BaseHeading>
              <BaseParagraph size="sm">
                <span class="text-muted-600 dark:text-muted-500">Most requested by businesses like yours</span>
              </BaseParagraph>
            </div>

            <div class="space-y-3">
              <BaseCard rounded="lg" class="flex items-center gap-4 p-4 hover:border-primary-500/30 transition-colors group cursor-pointer" @click="navigateToOrder('seo')">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <Icon name="lucide:search" class="size-5" />
                </div>
                <div class="grow">
                  <BaseHeading as="h4" size="sm" weight="medium" class="text-muted-800 dark:text-white group-hover:text-primary-500 transition-colors">
                    SEO Optimization
                  </BaseHeading>
                  <BaseParagraph size="xs">
                    <span class="text-muted-400">Rank #1 on Google Search</span>
                  </BaseParagraph>
                </div>
                <div class="ms-auto">
                  <BaseButton rounded="lg" size="icon-md" variant="muted" class="group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all">
                    <Icon name="lucide:arrow-right" class="size-5" />
                  </BaseButton>
                </div>
              </BaseCard>

              <BaseCard rounded="lg" class="flex items-center gap-4 p-4 hover:border-primary-500/30 transition-colors group cursor-pointer" @click="navigateToOrder('branding')">
                <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                  <Icon name="lucide:palette" class="size-5" />
                </div>
                <div class="grow">
                  <BaseHeading as="h4" size="sm" weight="medium" class="text-muted-800 dark:text-white group-hover:text-primary-500 transition-colors">
                    Branding & Design
                  </BaseHeading>
                  <BaseParagraph size="xs">
                    <span class="text-muted-400">Logo, UI/UX & Visual Identity</span>
                  </BaseParagraph>
                </div>
                <div class="ms-auto">
                  <BaseButton rounded="lg" size="icon-md" variant="muted" class="group-hover:bg-primary-500 group-hover:text-white group-hover:border-primary-500 transition-all">
                    <Icon name="lucide:arrow-right" class="size-5" />
                  </BaseButton>
                </div>
              </BaseCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* Animation for floating elements */
@keyframes float {
  0%,
  100% {
    transform: translateY(-70%) translateX(-30%) rotate(12deg);
  }
  50% {
    transform: translateY(-80%) translateX(-30%) rotate(10deg);
  }
}
.animate-float {
  animation: float 6s ease-in-out infinite;
}

@keyframes bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
.animate-bounce-slow {
  animation: bounce-slow 4s ease-in-out infinite;
}

.ease-out-back {
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
