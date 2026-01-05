<script setup lang="ts">
/**
 * Profile & Settings - Golden Master v2
 * -------------------------------------------
 * Updates:
 * - Expanded Organization/Company Tab based on user requirements.
 * - Added specific Select/Dropdown fields for Business Info.
 * - Added Status Toggles and Note areas.
 * - Maintained strict typing and responsive layout.
 */

import { reactive, ref, computed, onMounted } from 'vue'

// --- 1. TYPE DEFINITIONS ---
interface UserProfile {
  avatar: string | null
  coverImage: string | null
  firstName: string
  lastName: string
  preferredName: string // New
  email: string
  phone: string
  role: string
  bio: string
  familyStatus: string // New
  birthDay: string // New
  birthMonth: string // New
  birthYear: string // New
  gender: 'Male' | 'Female' | 'Other' // New
  mailingAddress: { // New
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  legalAddress: { // New
    street: string
    city: string
    state: string
    zip: string
    country: string
  }
  socials: {
    twitter: string
    linkedin: string
  }
}

interface CompanyProfile {
  logo: string
  name: string
  email: string
  website: string
  phone: string
  taxId: string
  address: string
  type: string
  income: string
  employees: string
  manager: string
  status: 'Active' | 'Inactive'
  notes: string
}

interface SecurityState {
  currentPassword: string
  newPassword: string
  confirmPassword: string
  twoFactor: boolean
}

interface Session {
  id: number
  device: string
  os: string
  location: string
  ip: string
  status: 'Active' | 'Signed out'
  lastActive: string
  icon: string
}

interface Invoice {
  id: string
  date: string
  amount: string
  status: 'Paid' | 'Pending' | 'Overdue'
}

// --- 2. CONFIG & STATE ---
definePageMeta({
  title: 'Profile Settings',
  layout: 'default',
  middleware: [],
  auth: false,
})

const activeTab = ref<'general' | 'company' | 'security' | 'billing'>('company') // Defaulted to company for preview
const isLoading = ref(false)
const isUploading = ref(false)

// --- 3. OPTIONS DATA (For Selects) ---
const companyTypes = ['Solo', 'Small Company (LLC)', 'Medium Company (Corp)', 'Bigger Company']
const incomeRanges = ['0 - 250K', '250K - 500K', '500K - 1M', '1M - 5M', '10M+']
const employeeRanges = ['1-10 employees', '10-50 employees', '50-100 employees', '100+ employees']
const managers = ['Sales Manager', 'Project Manager', 'UI/UX Designer', 'Mobile Developer', 'Product Manager']

// --- 4. DATA MODELS ---
// 2. آپدیت آبجکت userForm (جایگزین reactive قبلی شود)
const userForm = reactive<UserProfile>({
  avatar: 'https://i.pravatar.cc/150?u=101',
  coverImage: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1400&q=80',
  firstName: 'Kendra',
  lastName: 'Wilson',
  preferredName: 'Ken',
  email: 'kendra.wilson@apexdigi.co.uk',
  phone: '+1 (555) 123-4567',
  role: 'Product Designer',
  bio: 'Senior Product Designer specialized in Fintech.',
  familyStatus: 'Single',
  birthDay: '15',
  birthMonth: 'August',
  birthYear: '1990',
  gender: 'Female',
  mailingAddress: {
    street: '123 Mailing St, Suite 400',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    country: 'United States'
  },
  legalAddress: {
    street: '450 Legal Ave',
    city: 'New York',
    state: 'NY',
    zip: '10017',
    country: 'United States'
  },
  socials: {
    twitter: '@kendra_w',
    linkedin: 'kendra-wilson-pro'
  }
})

const companyForm = reactive<CompanyProfile>({
  logo: 'https://img.logoipsum.com/296.svg',
  name: 'Apex Digital Agency',
  email: 'contact@apexdigi.co.uk',
  website: 'https://apexdigi.co.uk',
  phone: '+1 (555) 000-9988',
  taxId: 'US-8839201',
  address: '450 Lexington Ave, New York, NY',
  type: 'Small Company (LLC)',
  income: '1M - 5M',
  employees: '10-50 employees',
  manager: 'Product Manager',
  status: 'Active',
  notes: 'Leading agency in fintech solutions and digital transformation.'
})

const securityForm = reactive<SecurityState>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  twoFactor: true
})

// Mock Data Lists
const activeSessions = ref<Session[]>([
  { id: 1, device: 'MacBook Pro 16"', os: 'macOS Sonoma', location: 'New York, USA', ip: '192.168.1.1', status: 'Active', lastActive: 'Now', icon: 'lucide:laptop' },
  { id: 2, device: 'iPhone 15 Pro', os: 'iOS 17.4', location: 'New York, USA', ip: '10.0.0.12', status: 'Active', lastActive: '2h ago', icon: 'lucide:smartphone' },
])

const invoices = ref<Invoice[]>([
  { id: 'INV-001', date: 'Oct 01, 2025', amount: '$29.00', status: 'Paid' },
  { id: 'INV-002', date: 'Sep 01, 2025', amount: '$29.00', status: 'Paid' },
])

// --- 5. ACTIONS ---
const handleImageUpload = (event: Event, type: 'avatar' | 'cover') => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    isUploading.value = true
    const reader = new FileReader()
    reader.onload = (e) => {
      setTimeout(() => {
        if (e.target?.result) {
          if (type === 'avatar') userForm.avatar = e.target.result as string
          if (type === 'cover') userForm.coverImage = e.target.result as string
        }
        isUploading.value = false
      }, 1000)
    }
    reader.readAsDataURL(input.files[0])
  }
}

const saveAll = async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1500))
  isLoading.value = false
}

const revokeSession = (id: number) => {
  const session = activeSessions.value.find(s => s.id === id)
  if (session) session.status = 'Signed out'
}
// 3. اضافه کردن لیست‌های انتخابی (در انتهای بخش متغیرها اضافه کنید)
const familyStatusOptions = ['Single', 'Married', 'Divorced', 'Widow/Widower']
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const days = Array.from({length: 31}, (_, i) => (i + 1).toString())
const years = Array.from({length: 80}, (_, i) => (2024 - i).toString()) // سال‌های 1944 تا 2024
const countries = ['United States', 'Canada', 'France', 'Germany', 'Spain', 'China', 'Japan']
</script>

<template>
  <div class="w-full min-h-screen bg-[#0f111a] font-sans text-muted-100 p-4 md:p-6 lg:p-8 flex flex-col overflow-x-hidden relative">
    
    <input type="file" ref="avatarInput" class="hidden" accept="image/*" @change="(e) => handleImageUpload(e, 'avatar')">
    <input type="file" ref="coverInput" class="hidden" accept="image/*" @change="(e) => handleImageUpload(e, 'cover')">

    <div class="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div class="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-[120px] mix-blend-screen" />
      <div class="absolute bottom-[-10%] left-[-5%] w-[700px] h-[700px] bg-indigo-600/5 rounded-full blur-[120px] mix-blend-screen" />
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] brightness-100 contrast-150" />
    </div>

    <div class="max-w-[1400px] mx-auto w-full relative z-10 mb-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-light text-white tracking-tight">Account <span class="font-bold text-[#6366f1]">Settings</span></h1>
          <p class="text-xs text-muted-500 mt-1.5 font-medium">Manage your personal data, company info, and preferences.</p>
        </div>
        
        <div class="flex items-center gap-3">
          <button class="px-5 py-2.5 rounded-xl border border-white/5 hover:bg-white/5 text-muted-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-all duration-300">
            Discard
          </button>
          <button 
            @click="saveAll"
            :disabled="isLoading"
            class="relative overflow-hidden flex items-center gap-2 px-8 py-2.5 rounded-xl bg-[#6366f1] hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            <span v-if="!isLoading" class="relative z-10 flex items-center gap-2">
              Save Changes <Icon name="lucide:check" class="w-3.5 h-3.5 group-hover:scale-125 transition-transform" />
            </span>
            <span v-else class="relative z-10 flex items-center gap-2">
              Processing <Icon name="lucide:loader-2" class="w-3.5 h-3.5 animate-spin" />
            </span>
            <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
      
      <div class="lg:col-span-12 relative mb-12 animate-fade-in" style="animation-delay: 0.1s;">
        <div class="relative w-full h-52 md:h-72 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl group select-none">
          <div v-if="isUploading" class="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <Icon name="lucide:loader-2" class="w-8 h-8 text-white animate-spin" />
          </div>
          <img :src="userForm.coverImage || ''" class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-1000 ease-out">
          <div class="absolute inset-0 bg-gradient-to-t from-[#0f111a] via-[#0f111a]/40 to-transparent"></div>
          <button @click="$refs.coverInput.click()" class="absolute top-6 right-6 px-4 py-2 rounded-2xl bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white transition-all flex items-center gap-2 group/btn translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100">
            <Icon name="lucide:image-plus" class="w-4 h-4 text-[#6366f1]" /> <span>Edit Cover</span>
          </button>
        </div>

        <div class="absolute -bottom-10 left-6 md:left-12 flex items-end gap-6 z-20">
          <div class="relative group/avatar">
            <div class="w-28 h-28 md:w-36 md:h-36 rounded-[2rem] p-1.5 bg-[#0f111a] shadow-2xl relative overflow-hidden">
              <img :src="userForm.avatar || ''" class="w-full h-full rounded-[1.6rem] object-cover bg-[#1c1c1c]">
              <div @click="$refs.avatarInput.click()" class="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer rounded-[2rem]">
                <Icon name="lucide:camera" class="w-6 h-6 text-white mb-1" />
                <span class="text-[9px] font-bold text-white uppercase tracking-wider">Change</span>
              </div>
            </div>
            <div class="absolute bottom-2 right-[-4px] w-6 h-6 bg-[#0f111a] rounded-full flex items-center justify-center z-30">
               <div class="w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-[#0f111a] shadow-[0_0_10px_#10b981]"></div>
            </div>
          </div>
          <div class="mb-2 hidden md:block pb-1">
            <h2 class="text-3xl font-bold text-white flex items-center gap-3">
              {{ userForm.firstName }} {{ userForm.lastName }}
              <div class="w-5 h-5 rounded-full bg-[#6366f1]/20 flex items-center justify-center border border-[#6366f1]/30">
                <Icon name="lucide:check" class="w-3 h-3 text-[#6366f1]" />
              </div>
            </h2>
            <p class="text-sm text-muted-400 font-medium mt-1 flex items-center gap-2">
              <span class="text-[#6366f1]">{{ userForm.role }}</span> 
              <span class="w-1 h-1 rounded-full bg-muted-600"></span> 
              <span>{{ companyForm.name }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="lg:col-span-12 md:hidden mb-6 mt-10 px-2 animate-fade-in">
        <h2 class="text-2xl font-bold text-white">{{ userForm.firstName }} {{ userForm.lastName }}</h2>
        <p class="text-sm text-muted-500">{{ userForm.role }}</p>
      </div>

      <div class="lg:col-span-3 flex flex-col gap-6 lg:sticky lg:top-6 animate-fade-in" style="animation-delay: 0.2s;">
        <div class="bg-[#161925] border border-white/5 rounded-[2rem] p-3 shadow-xl overflow-hidden">
          <nav class="flex flex-col gap-1">
            <button v-for="tab in ['general', 'company', 'security', 'billing']" :key="tab" @click="activeTab = tab"
              class="group flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all duration-300 relative overflow-hidden capitalize"
              :class="activeTab === tab ? 'bg-white/5 text-white shadow-inner border border-white/5' : 'text-muted-400 hover:bg-white/[0.02] hover:text-white border border-transparent'">
              <div v-if="activeTab === tab" class="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-[#6366f1] rounded-r-full shadow-[0_0_10px_#6366f1]"></div>
              <Icon :name="tab === 'general' ? 'lucide:user-circle' : tab === 'company' ? 'lucide:building-2' : tab === 'security' ? 'lucide:shield-check' : 'lucide:wallet'" class="w-5 h-5 shrink-0 transition-colors" :class="activeTab === tab ? 'text-[#6366f1]' : 'text-muted-500 group-hover:text-white'" />
              <span class="text-sm font-bold tracking-wide">{{ tab }}</span>
            </button>
          </nav>
        </div>
      </div>

      <div class="lg:col-span-9 animate-fade-in" style="animation-delay: 0.3s;">
        
       <div v-if="activeTab === 'general'" class="bg-[#161925] border border-white/5 rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden">
  <div class="absolute top-0 right-0 p-6 opacity-5 pointer-events-none"><Icon name="lucide:user" class="w-64 h-64 text-white" /></div>
  
  <h3 class="text-xl font-bold text-white mb-8 relative z-10 flex items-center gap-2">
    Personal Info <span class="text-xs font-normal text-muted-500 bg-white/5 px-2 py-1 rounded-lg">Basic info about you</span>
  </h3>
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
    
    <div class="group">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">First Name</label>
      <input v-model="userForm.firstName" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all shadow-inner">
    </div>
    <div class="group">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Last Name</label>
      <input v-model="userForm.lastName" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all shadow-inner">
    </div>
    <div class="group">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Preferred Name</label>
      <input v-model="userForm.preferredName" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all shadow-inner">
    </div>
    
    <div class="group">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
      <input v-model="userForm.email" type="email" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all shadow-inner">
    </div>
    <div class="group">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
      <input v-model="userForm.phone" type="tel" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all shadow-inner">
    </div>

    <div class="group relative">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Family Status</label>
      <div class="relative">
        <select v-model="userForm.familyStatus" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
          <option v-for="status in familyStatusOptions" :key="status" :value="status">{{ status }}</option>
        </select>
        <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
      </div>
    </div>

    <div class="md:col-span-2">
      <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Birthday</label>
      <div class="grid grid-cols-3 gap-4">
        <div class="relative">
          <select v-model="userForm.birthDay" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-8 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
             <option value="" disabled>Day</option>
             <option v-for="day in days" :key="day" :value="day">{{ day }}</option>
          </select>
          <Icon name="lucide:chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
        </div>
        <div class="relative">
          <select v-model="userForm.birthMonth" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-8 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
             <option value="" disabled>Month</option>
             <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
          </select>
          <Icon name="lucide:chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
        </div>
        <div class="relative">
          <select v-model="userForm.birthYear" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-8 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
             <option value="" disabled>Year</option>
             <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
          <Icon name="lucide:chevron-down" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
        </div>
      </div>
    </div>

    <div class="md:col-span-2">
       <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Gender</label>
       <div class="flex gap-4">
          <button v-for="g in ['Male', 'Female', 'Other']" :key="g"
                  @click="userForm.gender = g" 
                  class="flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-medium" 
                  :class="userForm.gender === g ? 'bg-[#6366f1]/10 border-[#6366f1] text-[#6366f1]' : 'bg-[#0f111a] border-white/10 text-muted-400 hover:border-white/20 hover:text-white'">
             <Icon :name="g === 'Male' ? 'lucide:move-right' : g === 'Female' ? 'lucide:move-up-right' : 'lucide:circle'" class="w-4 h-4" />
             {{ g }}
          </button>
       </div>
    </div>

    <div class="md:col-span-2 h-px bg-white/5 my-4"></div>

    <div class="md:col-span-2">
      <h4 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
         <div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><Icon name="lucide:mail" class="w-4 h-4" /></div>
         Mailing Address
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div class="md:col-span-2 group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Address (Street / Suite)</label>
            <input v-model="userForm.mailingAddress.street" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">City</label>
            <input v-model="userForm.mailingAddress.city" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">State / Province</label>
            <input v-model="userForm.mailingAddress.state" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Zip Code</label>
            <input v-model="userForm.mailingAddress.zip" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white font-mono focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group relative">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Country</label>
            <div class="relative">
              <select v-model="userForm.mailingAddress.country" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
                <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
              </select>
              <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
            </div>
         </div>
      </div>
    </div>

    <div class="md:col-span-2 h-px bg-white/5 my-4"></div>

    <div class="md:col-span-2">
      <h4 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
         <div class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400"><Icon name="lucide:scale" class="w-4 h-4" /></div>
         Legal Address
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div class="md:col-span-2 group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Address (Street / Suite)</label>
            <input v-model="userForm.legalAddress.street" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">City</label>
            <input v-model="userForm.legalAddress.city" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">State / Province</label>
            <input v-model="userForm.legalAddress.state" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Zip Code</label>
            <input v-model="userForm.legalAddress.zip" type="text" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white font-mono focus:border-[#6366f1] focus:outline-none transition-all">
         </div>
         <div class="group relative">
            <label class="block text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 ml-1">Country</label>
            <div class="relative">
              <select v-model="userForm.legalAddress.country" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
                <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
              </select>
              <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
            </div>
         </div>
      </div>
    </div>

  </div>
</div>

        <div v-if="activeTab === 'company'" class="bg-[#161925] border border-white/5 rounded-[2.5rem] p-6 md:p-10 animate-fade-in relative overflow-hidden">
           
           <div class="flex flex-col md:flex-row md:items-center gap-6 mb-10 pb-8 border-b border-white/5">
              <div class="w-24 h-24 rounded-[1.5rem] bg-white p-5 flex items-center justify-center shadow-xl">
                <img :src="companyForm.logo" class="w-full h-full object-contain">
              </div>
              <div>
                <h3 class="text-2xl font-bold text-white">{{ companyForm.name }}</h3>
                <p class="text-sm text-muted-500 mb-3">Fill in business information about the company.</p>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                   <Icon name="lucide:shield-check" class="w-3 h-3" /> Verified Business
                </span>
              </div>
           </div>
           
           <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="group">
                 <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Company Name</label>
                 <input v-model="companyForm.name" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
              </div>
              <div class="group">
                 <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Company Email</label>
                 <input v-model="companyForm.email" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
              </div>
              <div class="group">
                 <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Company Website</label>
                 <input v-model="companyForm.website" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
              </div>
              <div class="group">
                 <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Company Phone</label>
                 <input v-model="companyForm.phone" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
              </div>

              <div class="md:col-span-2 pt-4 border-t border-white/5">
                 <h4 class="text-sm font-bold text-white mb-6 flex items-center gap-2"><Icon name="lucide:briefcase" class="w-4 h-4 text-[#6366f1]" /> Business Info</h4>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="group relative">
                       <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Company Type</label>
                       <div class="relative">
                          <select v-model="companyForm.type" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
                             <option v-for="type in companyTypes" :key="type" :value="type">{{ type }}</option>
                          </select>
                          <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
                       </div>
                    </div>
                    <div class="group relative">
                       <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Income</label>
                       <div class="relative">
                          <select v-model="companyForm.income" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
                             <option v-for="inc in incomeRanges" :key="inc" :value="inc">{{ inc }}</option>
                          </select>
                          <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
                       </div>
                    </div>
                    <div class="group relative">
                       <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Employees</label>
                       <div class="relative">
                          <select v-model="companyForm.employees" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
                             <option v-for="emp in employeeRanges" :key="emp" :value="emp">{{ emp }}</option>
                          </select>
                          <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
                       </div>
                    </div>
                    <div class="group relative">
                       <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Manager</label>
                       <div class="relative">
                          <select v-model="companyForm.manager" class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-4 pr-10 py-4 text-sm text-white focus:border-[#6366f1] focus:outline-none appearance-none cursor-pointer">
                             <option v-for="man in managers" :key="man" :value="man">{{ man }}</option>
                          </select>
                          <Icon name="lucide:chevron-down" class="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 pointer-events-none" />
                       </div>
                    </div>
                 </div>
              </div>

              <div class="md:col-span-2 pt-4 border-t border-white/5 space-y-6">
                 <div>
                    <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-4 block ml-1">Status</label>
                    <div class="flex gap-4">
                       <button @click="companyForm.status = 'Active'" class="flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2" :class="companyForm.status === 'Active' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-[#0f111a] border-white/10 text-muted-500 hover:border-white/20'">
                          <div class="w-2 h-2 rounded-full bg-emerald-500" v-if="companyForm.status === 'Active'"></div> Active
                       </button>
                       <button @click="companyForm.status = 'Inactive'" class="flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2" :class="companyForm.status === 'Inactive' ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-[#0f111a] border-white/10 text-muted-500 hover:border-white/20'">
                          <div class="w-2 h-2 rounded-full bg-rose-500" v-if="companyForm.status === 'Inactive'"></div> Inactive
                       </button>
                    </div>
                 </div>
                 
                 <div class="group">
                    <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block ml-1">Company Notes</label>
                    <textarea v-model="companyForm.notes" rows="3" class="w-full bg-[#0f111a] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all resize-none"></textarea>
                 </div>
              </div>
           </div>
        </div>

        <div v-if="activeTab === 'security'" class="bg-[#161925] border border-white/5 rounded-[2.5rem] p-6 md:p-10 animate-fade-in space-y-10">
           <div class="space-y-6">
              <div class="flex items-center gap-3 mb-2">
                 <div class="p-2.5 rounded-xl bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20"><Icon name="lucide:key-round" class="w-5 h-5" /></div>
                 <div><h3 class="text-lg font-bold text-white">Password</h3><p class="text-xs text-muted-500">Update your password securely.</p></div>
              </div>
              <div class="bg-[#0f111a] border border-white/5 rounded-2xl p-6 space-y-5">
                 <div class="group">
                    <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block">Current Password</label>
                    <input v-model="securityForm.currentPassword" type="password" class="w-full bg-[#161925] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
                 </div>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="group">
                       <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block">New Password</label>
                       <input v-model="securityForm.newPassword" type="password" class="w-full bg-[#161925] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
                    </div>
                    <div class="group">
                       <label class="text-[9px] font-bold text-muted-400 uppercase tracking-widest mb-2 block">Confirm Password</label>
                       <input v-model="securityForm.confirmPassword" type="password" class="w-full bg-[#161925] border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-[#6366f1] focus:outline-none transition-all">
                    </div>
                 </div>
              </div>
           </div>
           
           <div class="w-full h-px bg-white/5"></div>

           <div>
              <h3 class="text-lg font-bold text-white mb-5 flex items-center gap-2"><Icon name="lucide:laptop-2" class="w-5 h-5 text-muted-400" /> Active Sessions</h3>
              <div class="space-y-3">
                 <div v-for="session in activeSessions" :key="session.id" class="flex items-center justify-between p-4 rounded-2xl bg-[#0f111a] border border-white/5 hover:border-white/10 transition-colors group cursor-pointer">
                    <div class="flex items-center gap-4">
                       <div class="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-muted-400 group-hover:text-white group-hover:bg-[#6366f1]/10 transition-colors border border-white/5"><Icon :name="session.icon" class="w-6 h-6" /></div>
                       <div>
                          <h4 class="text-sm font-bold text-white flex items-center gap-2">{{ session.device }} <span v-if="session.status === 'Active'" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span></h4>
                          <p class="text-[10px] text-muted-500 font-mono mt-0.5">{{ session.location }} • {{ session.ip }}</p>
                       </div>
                    </div>
                    <div class="flex items-center gap-4">
                       <span class="text-[10px] font-bold uppercase hidden sm:block tracking-wider" :class="session.status === 'Active' ? 'text-emerald-400' : 'text-muted-600'">{{ session.status }}</span>
                       <button @click="revokeSession(session.id)" class="w-8 h-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 text-muted-500 flex items-center justify-center transition-colors"><Icon name="lucide:x" class="w-4 h-4" /></button>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        <div v-if="activeTab === 'billing'" class="bg-[#161925] border border-white/5 rounded-[2.5rem] p-6 md:p-10 animate-fade-in">
           <div class="flex items-center justify-between mb-8">
              <h3 class="text-xl font-bold text-white">Billing History</h3>
              <button class="text-xs font-bold text-[#6366f1] hover:text-white transition-colors flex items-center gap-2 bg-[#6366f1]/10 px-4 py-2 rounded-lg border border-[#6366f1]/20 hover:bg-[#6366f1] hover:border-[#6366f1]"><Icon name="lucide:download" class="w-3.5 h-3.5" /> Download All</button>
           </div>
           <div class="overflow-hidden rounded-2xl border border-white/5 bg-[#0f111a]">
              <table class="w-full text-left border-collapse">
                 <thead>
                    <tr class="bg-white/[0.02] border-b border-white/5">
                       <th class="p-5 text-[10px] font-bold text-muted-400 uppercase tracking-widest">Date</th>
                       <th class="p-5 text-[10px] font-bold text-muted-400 uppercase tracking-widest">Amount</th>
                       <th class="p-5 text-[10px] font-bold text-muted-400 uppercase tracking-widest">Status</th>
                    </tr>
                 </thead>
                 <tbody class="divide-y divide-white/5">
                    <tr v-for="inv in invoices" :key="inv.id" class="group hover:bg-white/[0.02] transition-colors">
                       <td class="p-5 text-xs text-muted-400">{{ inv.date }}</td>
                       <td class="p-5 text-sm font-bold text-white">{{ inv.amount }}</td>
                       <td class="p-5"><span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {{ inv.status }}</span></td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
* { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

/* SCROLLBARS */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 99px; border: 1px solid transparent; background-clip: content-box; transition: background-color 0.2s ease; }
::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
* { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.08) transparent; }

/* ANIMATIONS */
@keyframes content-enter {
  0% { opacity: 0; transform: translateY(12px) scale(0.98); filter: blur(4px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
.animate-fade-in { animation: content-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; will-change: transform, opacity, filter; backface-visibility: hidden; }

/* FORM ELEMENTS */
input, textarea, button, select { appearance: none; -webkit-appearance: none; outline: none; }
input:focus, textarea:focus, select:focus { box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 0 0 1px #6366f1, 0 0 12px rgba(99, 102, 241, 0.15); border-color: #6366f1; }
textarea { resize: none; field-sizing: content; min-height: 100px; }
::placeholder { color: rgba(148, 163, 184, 0.5); font-size: 0.875rem; }

/* TABLES */
table { border-collapse: separate; border-spacing: 0 4px; width: 100%; }
tbody tr td:first-child { border-top-left-radius: 0.75rem; border-bottom-left-radius: 0.75rem; }
tbody tr td:last-child { border-top-right-radius: 0.75rem; border-bottom-right-radius: 0.75rem; }
tbody tr { transition: all 0.2s ease; }

/* UTILS */
.hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@supports (height: 100dvh) { .min-h-screen { min-height: 100dvh; } }
button, .group\/avatar { user-select: none; -webkit-user-select: none; }
</style>