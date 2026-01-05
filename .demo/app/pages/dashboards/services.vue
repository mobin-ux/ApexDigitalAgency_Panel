<script setup lang="ts">
/**
 * Apex Project Estimator - Fixed 2-Column Layout
 * Structure: Flexbox (Fluid Left + Fixed Right Sidebar)
 * Theme: Dark Cyberpunk / Neon
 */

// --- DATA ---
const categories = [
  { 
    id: 'web_dev', 
    label: 'Web Development', 
    desc: 'WordPress, React & Custom Code', 
    icon: 'lucide:code-2', 
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border_active: 'border-blue-500',
    ring: 'ring-blue-500/20'
  },
  { 
    id: 'marketing', 
    label: 'Marketing & Ads', 
    desc: 'SEO, PPC & Growth Hacking', 
    icon: 'lucide:bar-chart-2', 
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border_active: 'border-emerald-500',
    ring: 'ring-emerald-500/20'
  },
  { 
    id: 'web_design', 
    label: 'UI/UX Design', 
    desc: 'Visuals, Prototyping & Motion', 
    icon: 'lucide:palette', 
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border_active: 'border-pink-500',
    ring: 'ring-pink-500/20'
  },
  { 
    id: 'branding', 
    label: 'Branding', 
    desc: 'Logo, Identity & Strategy', 
    icon: 'lucide:fingerprint', 
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border_active: 'border-violet-500',
    ring: 'ring-violet-500/20'
  },
]

const subServices = {
  web_dev: {
    title: 'Development Plans',
    options: [
      { id: 'basic_wp', title: 'Basic WordPress', desc: 'Mobile friendly, Basic SEO, 6mo support', price: 499, unit: 'mo' },
      { id: 'std_wp', title: 'Standard WordPress', desc: 'Custom UI/UX, Lead forms, 12mo support', price: 799, unit: 'mo' },
      { id: 'vip_web', title: 'VIP Website Design', desc: 'React/Next.js, API Integrations, Priority', price: 0, unit: 'custom' },
    ]
  },
  marketing: {
    title: 'Growth Plans',
    options: [
      { id: 'basic_mkt', title: 'Basic (Starter Growth)', desc: 'GMB Setup, Basic PPC (Google/FB)', price: 499, unit: 'mo' },
      { id: 'std_mkt', title: 'Standard (Best Value)', desc: 'Full SEO Strategy, Dedicated Manager', price: 899, unit: 'mo' },
      { id: 'vip_mkt', title: 'VIP Plan', desc: 'Omnichannel Ads (TikTok/FB/Google)', price: 0, unit: 'custom' },
    ]
  },
  web_design: {
    title: 'Design Plans',
    options: [
      { id: 'basic_des', title: 'Basic (Starter)', desc: 'UX Research, UI Design, 1 Revision', price: 399, unit: 'mo' },
      { id: 'std_des', title: 'Standard (Best Value)', desc: 'Animations, 3 Revisions, User Tracking', price: 699, unit: 'mo' },
      { id: 'vip_des', title: 'VIP Plan', desc: 'Full Brand Strategy, Unlimited Revisions', price: 0, unit: 'custom' },
    ]
  },
  branding: {
    title: 'Identity Packages',
    options: [
      { id: 'logo', title: 'Logo Design', desc: 'Vector logo + guidelines', price: 600, unit: 'one-time' },
      { id: 'full', title: 'Full Identity', desc: 'Logo, Social Kit, Stationery', price: 1500, unit: 'one-time' },
    ]
  }
}

// --- STATE ---
const currentStep = ref(0)
const selectedCatId = ref('')
const selectedOptionId = ref('')
const budget = ref(1000)
const customerInfo = reactive({ name: '', email: '' })

// --- LOGIC ---
const activeCategory = computed(() => categories.find(c => c.id === selectedCatId.value))
const activeSubServices = computed(() => selectedCatId.value ? subServices[selectedCatId.value as keyof typeof subServices] : null)

const invoiceItems = computed(() => {
  const items = []
  if (activeCategory.value) {
    items.push({ title: `${activeCategory.value.label}`, type: 'Category', price: 0 })
  }
  
  if (activeSubServices.value && selectedOptionId.value) {
    const found = activeSubServices.value.options.find(o => o.id === selectedOptionId.value)
    if (found) {
      items.push({ 
        title: found.title, 
        type: found.price === 0 ? 'Custom Quote' : `Plan`, 
        price: found.price 
      })
    }
  }
  return items
})

const subTotal = computed(() => invoiceItems.value.reduce((acc, item) => acc + item.price, 0))
const totalDue = computed(() => subTotal.value)
const invoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`
const todayDate = new Date().toLocaleDateString('en-GB')

const formatCurrency = (val: number) => {
  if (val === 0) return 'Contact for Quote'
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(val)
}

const next = () => { if (currentStep.value < 2) currentStep.value++ }
const prev = () => { if (currentStep.value > 0) currentStep.value-- }
const selectCategory = (id: string) => { selectedCatId.value = id; selectedOptionId.value = '' }
</script>

<template>
  <div class="w-full min-h-screen bg-[#0f111a] font-sans text-gray-200 p-4 md:p-8">
    
    <div class="max-w-[1600px] mx-auto">
      
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <span class="text-xs font-bold text-primary-500 uppercase tracking-widest mb-1 block">Project Estimator</span>
          <h1 class="text-3xl md:text-4xl font-light text-white">
            Start a <span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500">Project</span>
          </h1>
        </div>
        
        <div class="inline-flex bg-[#161925] border border-white/5 rounded-full p-1">
          <button v-for="(step, i) in ['Service', 'Plan', 'Finalize']" :key="i"
                  @click="i < currentStep ? currentStep = i : null"
                  class="px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300"
                  :class="currentStep === i ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'">
            {{ step }}
          </button>
        </div>
      </div>

      <div class="flex flex-col xl:flex-row gap-8 items-start">
        
        <div class="flex-1 w-full min-w-0">
          <div class="bg-[#161925] border border-white/5 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden min-h-[600px] flex flex-col">
            
            <Transition name="fade" mode="out-in">
              <div v-if="currentStep === 0" class="flex-1 flex flex-col h-full">
                <div class="mb-8">
                  <h2 class="text-2xl font-medium text-white">Select a Service</h2>
                  <p class="text-gray-500 mt-1">What expertise do you need?</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div v-for="cat in categories" :key="cat.id" @click="selectCategory(cat.id)"
                       class="group cursor-pointer relative h-full">
                    
                    <div class="relative h-full p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col gap-4 bg-[#1c2030] hover:bg-[#23273a]"
                         :class="selectedCatId === cat.id 
                           ? `${cat.border_active} bg-[#1f2336] ring-1 ${cat.ring}` 
                           : 'border-white/5 hover:border-white/10'">
                      
                      <div class="flex justify-between items-start">
                        <div class="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                             :class="`${cat.bg} ${cat.color}`">
                          <Icon :name="cat.icon" class="w-6 h-6" />
                        </div>
                        
                        <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                             :class="selectedCatId === cat.id ? 'bg-primary-500 border-primary-500 text-white' : 'border-white/10 opacity-30'">
                          <Icon name="lucide:check" class="w-3.5 h-3.5" v-if="selectedCatId === cat.id" />
                        </div>
                      </div>

                      <div class="mt-2">
                        <h3 class="text-lg font-bold text-white">{{ cat.label }}</h3>
                        <p class="text-xs text-gray-500 mt-1 leading-relaxed">{{ cat.desc }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="currentStep === 1" class="flex-1 flex flex-col h-full">
                <div class="flex items-center justify-between mb-8">
                  <div>
                    <h2 class="text-2xl font-medium text-white">Select a Plan</h2>
                    <p class="text-gray-500 mt-1 text-sm">For <span class="font-bold text-primary-500">{{ activeCategory?.label }}</span></p>
                  </div>
                  <button @click="prev" class="text-xs font-bold uppercase text-gray-500 hover:text-white transition-colors">Change Service</button>
                </div>

                <div class="space-y-4">
                  <div v-if="activeSubServices" class="grid gap-4">
                    <label v-for="opt in activeSubServices.options" :key="opt.id"
                           class="relative flex flex-col sm:flex-row sm:items-center p-5 rounded-2xl border-2 cursor-pointer transition-all bg-[#1c2030] hover:bg-[#23273a]"
                           :class="selectedOptionId === opt.id 
                             ? 'border-primary-500 ring-1 ring-primary-500/20' 
                             : 'border-white/5 hover:border-white/10'">
                      
                      <input type="radio" :value="opt.id" v-model="selectedOptionId" class="peer sr-only" />

                      <div class="w-12 h-12 rounded-xl flex items-center justify-center mr-5 mb-4 sm:mb-0 transition-colors shrink-0"
                           :class="selectedOptionId === opt.id ? 'bg-primary-500 text-white' : 'bg-white/5 text-gray-400'">
                        <Icon v-if="opt.price === 0" name="lucide:crown" class="w-6 h-6" />
                        <Icon v-else name="lucide:zap" class="w-6 h-6" />
                      </div>

                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-bold text-white text-base sm:text-lg">{{ opt.title }}</span>
                          <span v-if="opt.price === 0" class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase border border-amber-500/20">VIP</span>
                        </div>
                        <p class="text-sm text-gray-500 leading-relaxed max-w-md">{{ opt.desc }}</p>
                      </div>

                      <div class="text-right pl-0 sm:pl-4 mt-4 sm:mt-0 min-w-[100px] flex sm:block justify-between items-center w-full sm:w-auto">
                        <div>
                          <span class="block font-bold font-mono text-white" :class="opt.price === 0 ? 'text-sm' : 'text-xl'">
                            {{ formatCurrency(opt.price) }}
                          </span>
                          <span v-if="opt.price > 0" class="text-[10px] font-bold text-gray-500 uppercase block mt-0.5">Per {{ opt.unit }}</span>
                        </div>
                        
                        <div class="sm:mt-2 flex justify-end">
                          <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                               :class="selectedOptionId === opt.id ? 'border-primary-500 bg-primary-500' : 'border-white/10'">
                            <div class="w-2 h-2 bg-white rounded-full scale-0 transition-transform" :class="selectedOptionId === opt.id ? 'scale-100' : ''"></div>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div v-else-if="currentStep === 2" class="flex-1 flex flex-col h-full">
                <div class="mb-8">
                  <h2 class="text-2xl font-medium text-white">Finalize Details</h2>
                  <p class="text-gray-500 mt-1">Set your budget & contact info.</p>
                </div>

                <div class="bg-black/40 rounded-2xl p-8 text-white mb-8 border border-white/5 relative overflow-hidden">
                  <div class="relative z-10">
                    <div class="flex justify-between items-end mb-6">
                      <div>
                        <p class="text-xs font-bold uppercase text-gray-400 mb-2">Ad Spend / Budget</p>
                        <div class="text-4xl font-black font-mono tracking-tight">{{ formatCurrency(budget) }}</div>
                      </div>
                      <Icon name="lucide:trending-up" class="w-8 h-8 text-primary-500" />
                    </div>
                    
                    <div class="relative w-full h-3 rounded-full bg-white/10">
                       <input type="range" v-model.number="budget" min="100" max="30000" step="100" 
                           class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                       <div class="absolute top-0 left-0 h-full bg-primary-500 rounded-full" :style="{width: `${((budget - 100) / 29900) * 100}%`}"></div>
                       <div class="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg pointer-events-none transition-all" 
                            :style="{left: `calc(${((budget - 100) / 29900) * 100}% - 10px)`}"></div>
                    </div>

                    <div class="flex justify-between mt-3 text-[10px] text-gray-500 font-mono">
                      <span>£100</span><span>£30,000+</span>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="group">
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Full Name</label>
                    <div class="relative">
                      <input type="text" v-model="customerInfo.name" class="w-full bg-[#1c2030] border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-sm focus:border-primary-500 outline-none transition-all text-white placeholder-gray-600" placeholder="John Doe" />
                      <Icon name="lucide:user" class="absolute left-3.5 top-3.5 w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                  <div class="group">
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Email Address</label>
                    <div class="relative">
                      <input type="email" v-model="customerInfo.email" class="w-full bg-[#1c2030] border border-white/10 rounded-xl px-4 py-3.5 pl-11 text-sm focus:border-primary-500 outline-none transition-all text-white placeholder-gray-600" placeholder="email@company.com" />
                      <Icon name="lucide:mail" class="absolute left-3.5 top-3.5 w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                </div>
              </div>
            </Transition>

            <div class="mt-auto pt-8 flex justify-end gap-3 border-t border-white/5">
              <button v-if="currentStep > 0" @click="prev" class="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white transition-colors">Back</button>
              <button @click="next" :disabled="currentStep === 0 && !selectedCatId" 
                      class="px-8 py-3 rounded-xl bg-primary-600 text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {{ currentStep === 2 ? 'Send Request' : 'Continue' }}
              </button>
            </div>
          </div>
        </div>

        <div class="w-full xl:w-[380px] shrink-0">
          <div class="sticky top-8">
            <div class="bg-[#161925] rounded-2xl shadow-xl overflow-hidden border border-white/5">
              
              <div class="p-6 border-b border-white/5 bg-[#1c2030]">
                <div class="flex justify-between items-start mb-4">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black">
                      <Icon name="lucide:command" class="w-4 h-4" />
                    </div>
                    <span class="font-black text-lg tracking-tight text-white">INVOICE</span>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] font-bold text-gray-500 uppercase">Ref #</p>
                    <p class="font-mono text-xs font-bold text-white">{{ invoiceNumber }}</p>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                   <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 uppercase tracking-wide">Estimate</span>
                   <p class="text-xs text-gray-500 font-medium">{{ todayDate }}</p>
                </div>
              </div>

              <div class="p-6">
                <div class="flex justify-between mb-6 pb-6 border-b border-dashed border-white/10 text-xs">
                  <div>
                    <span class="block font-bold text-gray-500 uppercase mb-1">Billed To</span>
                    <span class="block font-bold text-white truncate">{{ customerInfo.name || 'Guest Client' }}</span>
                    <span class="block text-gray-500 mt-0.5 truncate">{{ customerInfo.email || 'email@example.com' }}</span>
                  </div>
                  <div class="text-right">
                    <span class="block font-bold text-gray-500 uppercase mb-1">Date</span>
                    <span class="block font-mono text-gray-300">{{ todayDate }}</span>
                  </div>
                </div>

                <div class="mb-6 bg-[#11131d] rounded-xl border border-white/5 overflow-hidden">
                  <div class="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 py-3 border-b border-white/5">
                    <span>Description</span>
                    <span>Amount</span>
                  </div>
                  
                  <div class="max-h-[300px] overflow-y-auto">
                    <template v-if="invoiceItems.length">
                      <div v-for="(item, i) in invoiceItems" :key="i" class="flex justify-between px-4 py-3 border-b border-white/5 last:border-0 text-xs">
                        <div class="pr-2">
                          <span class="font-bold text-gray-200 block">{{ item.title }}</span>
                          <span class="text-[10px] text-gray-500">{{ item.type }}</span>
                        </div>
                        <span class="font-mono font-medium text-gray-300 whitespace-nowrap">{{ formatCurrency(item.price) }}</span>
                      </div>
                    </template>
                    <div v-else class="p-8 text-center text-xs text-gray-500 italic">No items selected</div>
                  </div>
                  
                  <div class="px-4 py-3 bg-[#1c2030] border-t border-white/5 flex justify-between items-center text-xs">
                    <span class="font-bold text-primary-400 flex items-center gap-1.5">
                      <Icon name="lucide:plus" class="w-3 h-3" /> Ad Spend
                    </span>
                    <span class="font-mono font-bold text-white">{{ formatCurrency(budget) }}</span>
                  </div>
                </div>

                <div class="flex justify-between items-end border-t border-white/5 pt-4">
                  <div>
                    <span class="block text-[10px] font-bold text-gray-500 uppercase">Total Due</span>
                    <span class="text-xs text-gray-400">Excl. Tax</span>
                  </div>
                  <span class="text-3xl font-black text-white tracking-tighter">{{ formatCurrency(totalDue) }}</span>
                </div>
              </div>

              <div class="grid grid-cols-2 border-t border-white/5 bg-[#1c2030]">
                <button class="py-4 text-xs font-bold text-gray-400 hover:text-white transition-colors border-r border-white/5 flex items-center justify-center gap-2 hover:bg-white/5">
                  <Icon name="lucide:printer" class="w-3.5 h-3.5" /> Print
                </button>
                <button class="py-4 text-xs font-bold text-primary-500 hover:text-primary-400 transition-colors flex items-center justify-center gap-2 hover:bg-primary-500/10">
                  <Icon name="lucide:download" class="w-3.5 h-3.5" /> PDF
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
/* Fade Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>