<template>
  <div class="w-full min-h-screen bg-[#101828] font-sans text-muted-100 p-4 md:p-6 lg:p-8 flex flex-col overflow-x-hidden relative">
    
    <div class="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div class="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[120px] mix-blend-screen" />
      <div class="absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] bg-indigo-600/5 rounded-full blur-[120px] mix-blend-screen" />
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] brightness-100 contrast-150" />
    </div>

    <div class="max-w-[1400px] mx-auto w-full mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 relative z-10">
      <div>
        <h1 class="text-3xl font-light text-white tracking-tight">Dashboard <span class="font-bold text-[#6366f1]">Overview</span></h1>
        <p class="text-xs text-muted-400 mt-1.5 font-medium">Manage your projects, wallet, and services.</p>
      </div>
      <div class="hidden md:flex gap-3">
         <button class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#030712] border border-white/10 hover:border-white/20 text-muted-400 hover:text-white text-xs font-bold uppercase transition-all shadow-lg">
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
          <div class="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#030712] shadow-2xl group">
             
             <div class="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen translate-x-1/3 -translate-y-1/3 group-hover:bg-indigo-500/20 transition-colors duration-700"></div>
             <div class="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-[100px] mix-blend-screen -translate-x-1/3 translate-y-1/3"></div>
             
             <div class="absolute right-4 top-4 z-30">
                <button 
                  @click="showFeatures = false"
                  class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 flex items-center justify-center text-muted-400 hover:text-white transition-all duration-300 backdrop-blur-md"
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
                         Scale Your Business, <br />
                         <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Pay From Profits.</span>
                      </h2>
                      <p class="text-base md:text-lg text-muted-400 max-w-xl leading-relaxed">
                         Don't let cash flow stop your growth. Use our <strong>Zero Upfront Payment</strong> plan for Digital Marketing & SEO services.
                      </p>
                   </div>

                   <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                      <NuxtLink to="/orders/new" class="relative group/btn overflow-hidden rounded-2xl bg-white px-8 py-4 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]">
                         <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover/btn:opacity-10 transition-opacity duration-300"></div>
                         <span class="relative flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#030712]">
                            Get Started Now <Icon name="lucide:arrow-right" class="size-4 transition-transform group-hover/btn:translate-x-1" />
                         </span>
                      </NuxtLink>
                      <button class="px-6 py-4 rounded-2xl text-white text-sm font-bold hover:text-indigo-300 transition-colors flex items-center gap-2">
                         <Icon name="lucide:play-circle" class="size-5" /> How it works?
                      </button>
                   </div>
                </div>
                
                <div class="lg:col-span-5 relative hidden lg:block">
                   <div class="relative w-full h-[300px] perspective-1000">
                      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 bg-[#101828]/90 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl transform rotate-[-6deg] hover:rotate-0 transition-transform duration-500 z-20 group-hover:scale-105">
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
                            <div class="w-1/5 bg-indigo-500/20 rounded-t-sm h-[30%]"></div>
                            <div class="w-1/5 bg-indigo-500/40 rounded-t-sm h-[50%]"></div>
                            <div class="w-1/5 bg-indigo-500/60 rounded-t-sm h-[40%]"></div>
                            <div class="w-1/5 bg-indigo-500/80 rounded-t-sm h-[70%]"></div>
                            <div class="w-1/5 bg-indigo-500 rounded-t-sm h-[100%] animate-pulse"></div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </Transition>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in" style="animation-delay: 0.1s;">
        <div class="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#030712] p-6 group hover:border-orange-500/30 transition-all duration-300 shadow-xl">
           <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
           <div class="relative z-10 flex flex-col h-full justify-between">
              <div class="flex items-start justify-between mb-4">
                 <div class="flex items-center gap-3">
                    <div class="flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">
                       <Icon name="lucide:layers" class="size-5" />
                    </div>
                    <span class="text-xs font-bold uppercase tracking-wider text-muted-400">Projects</span>
                 </div>
                 <span v-if="stats[0].value > 0" class="flex size-2 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]"></span>
              </div>
              <div>
                 <div class="flex items-end gap-2 mb-2">
                    <h3 class="text-3xl font-black text-white">{{ stats[0].value }}</h3>
                    <span class="text-xs text-muted-500 mb-1.5 font-medium">Active Now</span>
                 </div>
                 <div class="space-y-1.5">
                    <div class="flex justify-between text-[9px] text-muted-400 uppercase font-bold">
                       <span>Progress</span>
                       <span class="text-orange-400">2 Needs Review</span>
                    </div>
                    <div class="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                       <div class="h-full w-[65%] rounded-full bg-gradient-to-r from-orange-500 to-amber-500"></div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div class="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#030712] p-6 group hover:border-emerald-500/30 transition-all duration-300 shadow-xl">
           <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
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
                    <h3 class="text-3xl font-black text-white">$12,500</h3>
                    <span class="text-xs text-emerald-400 mb-1.5 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Approved</span>
                 </div>
                 <p class="text-[10px] text-muted-500 font-medium flex items-center gap-1">
                    <Icon name="lucide:check-circle" class="size-3 text-muted-600" /> 
                    <span>Zero interest for next 30 days</span>
                 </p>
              </div>
           </div>
        </div>

        <div class="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#030712] p-6 group hover:border-indigo-500/30 transition-all duration-300 shadow-xl">
           <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
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
               <div v-for="project in activeProjects" :key="project.id" 
                    class="group relative overflow-hidden rounded-2xl border border-white/5 bg-[#030712] p-4 transition-all duration-300 hover:border-primary-500/30 shadow-lg">
                  <div class="flex items-start gap-4">
                     <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#101828] text-muted-400 ring-1 ring-white/5 transition-all duration-300 group-hover:text-primary-400 group-hover:ring-primary-500/20">
                        <Icon :name="project.icon" class="size-6" />
                     </div>
                     <div class="min-w-0 flex-1">
                        <div class="flex items-start justify-between">
                           <div>
                              <h4 class="truncate font-sans text-sm font-bold text-white transition-colors group-hover:text-primary-400">{{ project.name }}</h4>
                              <p class="text-xs text-muted-500">{{ project.client }}</p>
                           </div>
                           <span class="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide border"
                                 :class="project.status === 'In Progress' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : project.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'">
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
                                 <div class="h-full w-[65%] rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
                  <div class="absolute inset-y-0 right-0 flex w-16 translate-x-full items-center justify-center bg-gradient-to-l from-[#030712] to-transparent transition-transform duration-300 group-hover:translate-x-0">
                     <button class="flex size-8 items-center justify-center rounded-lg bg-primary-500 text-white shadow-lg hover:bg-primary-400">
                        <Icon name="lucide:chevron-right" class="size-4" />
                     </button>
                  </div>
               </div>
            </div>

            <div v-else class="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-white/10 bg-[#030712]/50 p-8 text-center transition-all hover:border-primary-500/20">
               <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                  <Icon name="lucide:folder-plus" class="size-8 text-muted-500" />
               </div>
               <h4 class="text-lg font-bold text-white">No Active Projects</h4>
               <p class="mb-6 max-w-[200px] text-xs text-muted-500">Your workspace is empty.</p>
               <BaseButton to="/orders/new" color="primary" flavor="outline" rounded="lg">
                  <Icon name="lucide:plus" class="mr-2 size-4" /> Start Project
               </BaseButton>
            </div>
         </div>

         <div class="col-span-12 lg:col-span-7">
            
            <div class="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
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
               <div class="shrink-0">
                  <BaseButton rounded="lg" color="primary" flavor="outline" to="/services">
                     <span>View Full Catalog</span>
                  </BaseButton>
               </div>
            </div>

            <div class="grid grid-cols-12 gap-4">
               
               <div class="col-span-12 sm:col-span-6">
                  <NuxtLink to="/orders/new?service=marketing" class="group relative flex h-72 w-full flex-col overflow-hidden rounded-2xl bg-[#030712] border border-white/10 shadow-lg">
                     <img class="absolute inset-0 size-full object-cover object-center transition-transform duration-700 group-hover:scale-110 opacity-50" 
                          :src="services[0].image" 
                          alt="Digital Marketing">
                     <div class="absolute inset-0 z-10 bg-gradient-to-t from-[#030712] via-[#030712]/50 to-transparent opacity-90 transition-opacity duration-300"></div>
                     
                     <div class="absolute inset-0 z-20 flex size-full flex-col justify-between p-6">
                        <div class="flex items-center justify-between">
                           <h3 class="-translate-y-2 font-sans text-lg font-bold tracking-wider text-white opacity-0 transition-all delay-100 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              Digital Marketing
                           </h3>
                           <div class="flex size-8 -translate-y-2 items-center justify-center rounded-full bg-white/10 text-white opacity-0 backdrop-blur-sm transition-all delay-300 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              <Icon name="lucide:megaphone" class="size-4" />
                           </div>
                        </div>
                        <div class="flex items-end justify-between">
                           <div>
                              <p class="translate-y-2 font-sans text-xs font-medium text-gray-300 opacity-0 transition-all delay-500 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                 Zero upfront cost • ROI Focused
                              </p>
                              <div class="mt-2 h-1 w-12 rounded-full bg-pink-500 translate-y-2 opacity-0 transition-all delay-500 duration-300 group-hover:translate-y-0 group-hover:opacity-100"></div>
                           </div>
                           <div class="translate-y-2 opacity-0 transition-all delay-700 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              <Icon name="lucide:arrow-right" class="size-6 text-white" />
                           </div>
                        </div>
                     </div>
                  </NuxtLink>
               </div>

               <div class="col-span-12 sm:col-span-6">
                  <NuxtLink to="/orders/new?service=dev" class="group relative flex h-72 w-full flex-col overflow-hidden rounded-2xl bg-[#030712] border border-white/10 shadow-lg">
                     <img class="absolute inset-0 size-full object-cover object-center transition-transform duration-700 group-hover:scale-110 opacity-50" 
                          :src="services[1].image" 
                          alt="Web Development">
                     <div class="absolute inset-0 z-10 bg-gradient-to-t from-[#030712] via-[#030712]/50 to-transparent opacity-90 transition-opacity duration-300"></div>
                     <div class="absolute inset-0 z-20 flex size-full flex-col justify-between p-6">
                        <div class="flex items-center justify-between">
                           <h3 class="-translate-y-2 font-sans text-lg font-bold tracking-wider text-white opacity-0 transition-all delay-100 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              Web Development
                           </h3>
                           <div class="flex size-8 -translate-y-2 items-center justify-center rounded-full bg-white/10 text-white opacity-0 backdrop-blur-sm transition-all delay-300 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              <Icon name="lucide:code-2" class="size-4" />
                           </div>
                        </div>
                        <div class="flex items-end justify-between">
                           <div>
                              <p class="translate-y-2 font-sans text-xs font-medium text-gray-300 opacity-0 transition-all delay-500 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                 Modern Stack • High Performance
                              </p>
                              <div class="mt-2 h-1 w-12 rounded-full bg-cyan-500 translate-y-2 opacity-0 transition-all delay-500 duration-300 group-hover:translate-y-0 group-hover:opacity-100"></div>
                           </div>
                           <div class="translate-y-2 opacity-0 transition-all delay-700 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                              <Icon name="lucide:arrow-right" class="size-6 text-white" />
                           </div>
                        </div>
                     </div>
                  </NuxtLink>
               </div>

               <div class="col-span-12">
                  <div class="my-4">
                     <BaseHeading as="h3" size="lg" weight="medium" lead="tight" class="text-muted-900 dark:text-white">
                        <span>Popular Solutions</span>
                     </BaseHeading>
                  </div>
                  <div class="space-y-3">
                     <NuxtLink to="/orders/new?service=seo" class="group block">
                        <BaseCard rounded="lg" class="flex items-center gap-4 p-4 transition-colors duration-300 border border-white/5 bg-[#030712] hover:border-primary-500/30">
                           <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                              <Icon name="lucide:search" class="size-5" />
                           </div>
                           <div class="grow">
                              <BaseHeading as="h4" size="sm" weight="medium" class="text-muted-800 dark:text-white transition-colors group-hover:text-primary-500">
                                 SEO Optimization
                              </BaseHeading>
                              <BaseParagraph size="xs">
                                 <span class="text-muted-400">Rank #1 on Google Search</span>
                              </BaseParagraph>
                           </div>
                           <div class="ms-auto flex items-center">
                              <BaseButton rounded="lg" size="icon-md" variant="muted" class="scale-90 bg-[#101828] group-hover:bg-primary-500 group-hover:text-white transition-all">
                                 <Icon name="lucide:arrow-right" class="size-5" />
                              </BaseButton>
                           </div>
                        </BaseCard>
                     </NuxtLink>

                     <NuxtLink to="/orders/new?service=design" class="group block">
                        <BaseCard rounded="lg" class="flex items-center gap-4 p-4 transition-colors duration-300 border border-white/5 bg-[#030712] hover:border-primary-500/30">
                           <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 transition-colors group-hover:bg-purple-500 group-hover:text-white">
                              <Icon name="lucide:palette" class="size-5" />
                           </div>
                           <div class="grow">
                              <BaseHeading as="h4" size="sm" weight="medium" class="text-muted-800 dark:text-white transition-colors group-hover:text-primary-500">
                                 Branding & Design
                              </BaseHeading>
                              <BaseParagraph size="xs">
                                 <span class="text-muted-400">Logo, UI/UX & Visual Identity</span>
                              </BaseParagraph>
                           </div>
                           <div class="ms-auto flex items-center">
                              <BaseButton rounded="lg" size="icon-md" variant="muted" class="scale-90 bg-[#101828] group-hover:bg-primary-500 group-hover:text-white transition-all">
                                 <Icon name="lucide:arrow-right" class="size-5" />
                              </BaseButton>
                           </div>
                        </BaseCard>
                     </NuxtLink>
                  </div>
               </div>

            </div>
         </div>

      </div>

    </div>
  </div>
</template>
