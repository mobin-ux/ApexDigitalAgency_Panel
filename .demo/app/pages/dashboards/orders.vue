<script setup lang="ts">
import { ref, computed } from 'vue'

definePageMeta({
  title: 'My Orders',
  layout: 'sidenav',
  middleware: 'auth'
})

const router = useRouter()

// --- TYPES ---
interface Milestone {
  title: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
}

interface ProjectFile {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
}

interface Project {
  realId: string; // شناسه واقعی برای API
  id: string;     // شناسه نمایشی
  title: string;
  category: string;
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  progress: number;
  startDate: string;
  dueDate: string;
  price: number;
  image: string;
  milestones: Milestone[];
  files: ProjectFile[];
}

// --- API FETCHING ---
const { data: apiResponse, refresh, pending } = await useFetch('/api/orders')

// --- DATA ADAPTER (Database -> UI) ---
const projects = computed<Project[]>(() => {
  if (!apiResponse.value?.data) return []

  return apiResponse.value.data.map((order: any) => {
    // 1. Map Project Status
    let uiStatus: Project['status'] = 'pending'
    if (order.status === 'IN_PROGRESS') uiStatus = 'active'
    else if (order.status === 'COMPLETED') uiStatus = 'completed'
    else if (order.status === 'CANCELLED') uiStatus = 'cancelled'

    // 2. Map Milestones
    const mappedMilestones = order.milestones ? order.milestones.map((m: any) => ({
      title: m.title,
      status: m.status.toLowerCase(),
      date: m.date ? new Date(m.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : undefined
    })) : []

    // 3. Return Final Object
    return {
      realId: order.id, // مهم برای پرداخت
      id: order.id.substring(0, 8).toUpperCase(),
      title: order.name,
      category: order.category || 'General',
      status: uiStatus,
      progress: order.progress,
      startDate: new Date(order.startDate).toLocaleDateString(),
      dueDate: order.deadline ? new Date(order.deadline).toLocaleDateString() : 'TBD',
      price: order.amount || 0,
      image: order.category.includes('SEO') ? 'lucide:bar-chart' : 'lucide:box',
      milestones: mappedMilestones,
      files: order.files || [] // دریافت فایل‌ها از دیتابیس
    }
  })
})

// --- UI LOGIC ---
const selectedProject = ref<Project | null>(null)
const isPaying = ref(false)

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)

const getStatusColor = (status: string) => {
  switch(status) {
    case 'active': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'pending': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    case 'completed': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  }
}

const selectProject = (project: Project) => {
  selectedProject.value = project
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const goBack = () => {
  selectedProject.value = null
}

// --- ACTIONS (Backend Connected) ---

const handlePayProject = async () => {
  if (!selectedProject.value) return
  
  // تاییدیه از کاربر
  if (!confirm(`Confirm payment of ${formatCurrency(selectedProject.value.price)} for this project?`)) return

  isPaying.value = true
  try {
    await $fetch('/api/orders/pay', {
      method: 'POST',
      body: { projectId: selectedProject.value.realId } // استفاده از ID واقعی
    })
    
    await refresh() // رفرش کردن دیتا
    selectedProject.value = null // بستن پنل جزئیات
    alert('Payment successful! Project has been activated.')
  } catch (e: any) {
    alert(e.data?.message || 'Payment failed. Please check your wallet balance.')
  } finally {
    isPaying.value = false
  }
}

const handleChat = () => {
  // اینجا می‌توانید لاجیک باز کردن چت یا ریدایرکت را بگذارید
  router.push('/dashboards/support')
}
</script>

<template>
  <div class="w-full min-h-screen bg-[#0f111a] font-sans text-muted-100 p-4 md:p-8 relative overflow-x-hidden">
    
    <div class="fixed inset-0 pointer-events-none -z-10">
      <div class="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary-900/10 to-transparent opacity-50"></div>
      <div class="absolute top-20 right-[-100px] w-[400px] h-[400px] bg-primary-500/5 rounded-full blur-[100px]"></div>
    </div>

    <div class="max-w-7xl mx-auto">
      
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-light text-white">
            My <span class="font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-purple-500">Orders</span>
          </h1>
          <p class="text-muted-500 mt-1">Track your active projects and history.</p>
        </div>
        
        <button v-if="selectedProject" @click="goBack" 
                class="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm font-bold uppercase tracking-wider">
          <Icon name="lucide:arrow-left" class="w-4 h-4" />
          Back to List
        </button>
      </div>

      <Transition name="fade-slide" mode="out-in">
        
        <div v-if="!selectedProject" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div v-for="project in projects" :key="project.id" 
               @click="selectProject(project)"
               class="group relative bg-[#161925] border border-white/5 hover:border-primary-500/30 rounded-3xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/10 overflow-hidden">
            
            <div class="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-transparent to-primary-500/0 group-hover:from-primary-500/5 group-hover:to-purple-500/5 transition-all duration-500"></div>

            <div class="relative z-10 flex justify-between items-start mb-6">
              <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-muted-400 group-hover:text-white group-hover:bg-primary-500 group-hover:border-primary-500 transition-all">
                <Icon :name="project.image" class="w-6 h-6" />
              </div>
              <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider"
                    :class="getStatusColor(project.status)">
                {{ project.status }}
              </span>
            </div>

            <div class="relative z-10 mb-6">
              <h3 class="text-xl font-bold text-white mb-1 group-hover:text-primary-400 transition-colors">{{ project.title }}</h3>
              <p class="text-sm text-muted-500">{{ project.category }}</p>
            </div>

            <div class="relative z-10 mb-4">
              <div class="flex justify-between text-xs font-bold text-muted-400 mb-2">
                <span>Progress</span>
                <span>{{ project.progress }}%</span>
              </div>
              <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                     :style="{ width: `${project.progress}%` }"></div>
              </div>
            </div>

            <div class="relative z-10 pt-4 border-t border-white/5 flex justify-between items-center">
              <span class="text-xs text-muted-500 font-mono">{{ project.id }}</span>
              <div class="flex items-center gap-1 text-xs font-bold text-white group-hover:translate-x-1 transition-transform">
                Details <Icon name="lucide:chevron-right" class="w-3 h-3 text-primary-500" />
              </div>
            </div>
          </div>

          <div class="border-2 border-dashed border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-white/20 hover:bg-white/5 transition-all min-h-[250px] group">
            <div class="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-muted-500 mb-4 group-hover:scale-110 transition-transform">
              <Icon name="lucide:plus" class="w-6 h-6" />
            </div>
            <h3 class="text-lg font-medium text-white">Start New Project</h3>
            <p class="text-sm text-muted-500 mt-1">Get an estimate for a new order</p>
          </div>

        </div>

        <div v-else class="flex flex-col lg:flex-row gap-8 items-start">
          
          <div class="flex-1 w-full min-w-0 space-y-8">
            
            <div class="bg-[#161925] border border-white/5 rounded-3xl p-8 shadow-xl relative overflow-hidden">
              <div class="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-[80px]"></div>
              
              <div class="relative z-10 flex flex-col md:flex-row justify-between md:items-center gap-6 mb-8">
                <div>
                  <div class="flex items-center gap-3 mb-2">
                    <h2 class="text-3xl font-bold text-white">{{ selectedProject.title }}</h2>
                    <span class="px-3 py-1 rounded-full text-[10px] font-bold uppercase border tracking-wider"
                          :class="getStatusColor(selectedProject.status)">
                      {{ selectedProject.status }}
                    </span>
                  </div>
                  <p class="text-muted-400 text-sm">ID: <span class="font-mono text-muted-300">{{ selectedProject.id }}</span></p>
                </div>
                
                <div class="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div class="relative w-12 h-12 flex items-center justify-center">
                    <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <path class="text-white/5" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" />
                      <path class="text-primary-500" :stroke-dasharray="`${selectedProject.progress}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" />
                    </svg>
                    <span class="absolute text-[10px] font-bold">{{ selectedProject.progress }}%</span>
                  </div>
                  <div>
                    <p class="text-xs text-muted-400 font-bold uppercase">Overall</p>
                    <p class="text-sm font-bold text-white">Progress</p>
                  </div>
                </div>
              </div>

              <div class="relative">
                <div class="absolute left-6 top-0 bottom-0 w-px bg-white/10"></div>
                <div class="space-y-8">
                  <div v-for="(step, idx) in selectedProject.milestones" :key="idx" 
                       class="relative flex gap-6 group">
                    
                    <div class="relative z-10 w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full border-4 transition-all duration-300 bg-[#161925]"
                         :class="step.status === 'completed' ? 'border-emerald-500 text-emerald-500' : 
                                 step.status === 'current' ? 'border-primary-500 text-primary-500 shadow-[0_0_15px_rgba(var(--color-primary-500),0.4)]' : 
                                 'border-white/10 text-muted-600'">
                      <Icon v-if="step.status === 'completed'" name="lucide:check" class="w-5 h-5" />
                      <Icon v-else-if="step.status === 'current'" name="lucide:loader" class="w-5 h-5 animate-spin" />
                      <span v-else class="text-xs font-bold">{{ idx + 1 }}</span>
                    </div>

                    <div class="flex-1 pt-2">
                      <div class="flex justify-between items-center mb-1">
                        <h4 class="text-base font-bold transition-colors"
                            :class="step.status !== 'pending' ? 'text-white' : 'text-muted-500'">
                          {{ step.title }}
                        </h4>
                        <span v-if="step.date" class="text-xs font-mono text-muted-500 bg-white/5 px-2 py-0.5 rounded">{{ step.date }}</span>
                      </div>
                      <p class="text-xs text-muted-500" v-if="step.status === 'current'">Team is currently working on this stage.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <div class="bg-[#161925] border border-white/5 rounded-3xl p-6">
  <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
    <Icon name="lucide:folder-open" class="w-5 h-5 text-primary-500" />
    Project Files
  </h3>
  
  <div v-if="selectedProject.files.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div v-for="file in selectedProject.files" :key="file.id" class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 cursor-pointer transition-colors group">
      <div class="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
        <Icon name="lucide:file-code" class="w-5 h-5" />
      </div>
      <div class="overflow-hidden">
        <p class="text-sm font-medium text-white truncate">{{ file.name }}</p>
        <p class="text-xs text-muted-500">{{ file.size }}</p>
      </div>
    </div>
  </div>
  
  <div v-else class="text-center py-6 text-muted-500 text-sm border border-dashed border-white/10 rounded-xl">
    No files attached to this project yet.
  </div>
</div>

          </div>

          <div class="w-full lg:w-[350px] shrink-0 space-y-6">
            
            <div class="bg-[#161925] border border-white/5 rounded-3xl p-6 sticky top-6">
              <h3 class="text-sm font-bold text-muted-400 uppercase tracking-widest mb-6">Project Summary</h3>
              
              <div class="space-y-4 mb-6">
                <div class="flex justify-between items-center py-3 border-b border-white/5">
                  <span class="text-sm text-muted-400">Total Budget</span>
                  <span class="text-lg font-mono font-bold text-white">{{ formatCurrency(selectedProject.price) }}</span>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-white/5">
                  <span class="text-sm text-muted-400">Start Date</span>
                  <span class="text-sm font-medium text-white">{{ selectedProject.startDate }}</span>
                </div>
                <div class="flex justify-between items-center py-3 border-b border-white/5">
                  <span class="text-sm text-muted-400">Due Date</span>
                  <span class="text-sm font-medium text-white">{{ selectedProject.dueDate }}</span>
                </div>
              </div>

              <div class="bg-white/5 rounded-2xl p-4 flex items-center gap-3 mb-6">
                <div class="w-10 h-10 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center">
                  <Icon name="lucide:user" class="w-5 h-5" />
                </div>
                <div>
                  <p class="text-xs text-muted-400 font-bold uppercase">Project Manager</p>
                  <p class="text-sm font-bold text-white">Sarah Connor</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <button @click="handleChat" class="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold uppercase transition-colors">
                  <Icon name="lucide:message-square" class="w-4 h-4" /> Chat
                </button>
               <button 
    @click="handlePayProject"
    :disabled="isPaying || selectedProject.status !== 'pending'"
    class="flex items-center justify-center gap-2 py-3 rounded-xl text-white text-xs font-bold uppercase transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    :class="selectedProject.status === 'pending' ? 'bg-primary-600 hover:bg-primary-500 shadow-primary-500/20' : 'bg-green-600 hover:bg-green-500 shadow-green-500/20'"
  >
    <Icon v-if="isPaying" name="lucide:loader-2" class="w-4 h-4 animate-spin" />
    <span v-else>{{ selectedProject.status === 'pending' ? 'Pay Now' : 'Paid' }}</span>
  </button>
              </div>
            </div>

          </div>

        </div>

      </Transition>

    </div>
  </div>
</template>

<style scoped>
/* Animations */
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
