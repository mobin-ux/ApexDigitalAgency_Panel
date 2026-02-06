<script setup lang="ts">
/**
 * Support Center - Enterprise Logic (Backend Connected)
 * -----------------------------------------------------
 * Logic: Fully connected to API (create, list, reply).
 * UI: Original Bento Grid preserved + New Ticket Modal added.
 */

import { computed, nextTick, onMounted, ref, watch } from 'vue'

definePageMeta({
  title: 'Support Center',
  layout: 'sidenav',
  middleware: 'auth', // Added Security
  auth: false,
})

// --- 1. STATE & DATA FETCHING ---
// دریافت لیست تیکت‌ها از سرور
const { data: apiData, refresh: refreshTickets } = await useFetch('/api/support/tickets')

// نگاشت داده‌های سرور به فرمت مورد نیاز قالب
const tickets = computed(() => {
  if (!apiData.value?.tickets) return []
  
  return apiData.value.tickets.map((t: any) => ({
    id: t.id, 
    displayId: `#TK-${t.id.substring(0, 4).toUpperCase()}`,
    subject: t.subject,
    category: t.category,
    status: t.status === 'ANSWERED' ? 'Pending' : (t.status === 'OPEN' ? 'Open' : 'Closed'),
    priority: t.priority.charAt(0) + t.priority.slice(1).toLowerCase(),
    created: new Date(t.createdAt).toLocaleDateString(),
    lastUpdate: 'Recently', // Simplified for demo
    preview: t.messages[0]?.content || 'No preview available',
    tags: [t.category],
    customer: {
      id: t.userId,
      name: 'Me', 
      avatar: 'https://i.pravatar.cc/150?u=' + t.userId,
      role: 'user',
      status: 'online'
    },
    // Agent is mocked for UI consistency
    assignedAgent: {
      id: 999,
      name: 'Support Team',
      avatar: 'https://i.pravatar.cc/150?u=support',
      role: 'agent',
      status: 'busy'
    },
    messages: [] // Loaded on click
  }))
})

// --- 2. LOCAL STATE ---
const activeFilter = ref('All')
const searchQuery = ref('')
const activeTicketId = ref<string | null>(null)
const replyMessage = ref('')
const isSending = ref(false)
const chatContainerRef = ref<HTMLElement | null>(null)
const filters = ['All', 'Open', 'Pending', 'Closed']

// New Ticket Modal State
const showNewTicketModal = ref(false)
const isCreating = ref(false)
const newTicketForm = ref({ subject: '', category: 'Technical', priority: 'NORMAL', message: '' })

// --- 3. COMPUTED LOGIC ---
const filteredTickets = computed(() => {
  let result = tickets.value
  if (activeFilter.value !== 'All') {
    result = result.filter((t: any) => t.status === activeFilter.value)
  }
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((t: any) =>
      t.subject.toLowerCase().includes(query) ||
      t.displayId.toLowerCase().includes(query)
    )
  }
  return result
})

const selectedTicket = computed(() => {
  return tickets.value.find((t: any) => t.id === activeTicketId.value)
})

// --- 4. MESSAGING LOGIC ---
const messagesState = ref<Record<string, any[]>>({}) // Cache

// Load messages when ticket selected
watch(activeTicketId, async (newId) => {
  if (!newId) return
  
  if (!messagesState.value[newId]) {
    try {
      const res = await $fetch<any>(`/api/support/${newId}/messages`)
      messagesState.value[newId] = res.messages.map((m: any) => ({
        id: m.id,
        sender: m.isAdmin 
          ? { id: 999, name: 'Support Agent', role: 'agent', avatar: 'https://i.pravatar.cc/150?u=support' }
          : { id: 'me', name: 'Me', role: 'user', avatar: 'https://i.pravatar.cc/150?u=me' },
        text: m.content,
        time: new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        isSystem: false
      }))
    } catch (e) { console.error(e) }
  }
  
  if (selectedTicket.value) {
    selectedTicket.value.messages = messagesState.value[newId]
  }
  scrollToBottom()
})

async function sendMessage() {
  if (!replyMessage.value.trim() || !activeTicketId.value) return

  const text = replyMessage.value
  replyMessage.value = ''
  isSending.value = true

  try {
    const { message } = await $fetch<any>(`/api/support/${activeTicketId.value}/reply`, {
      method: 'POST',
      body: { content: text }
    })

    const newMessage = {
      id: message.id,
      sender: { id: 'me', name: 'Me', role: 'user', avatar: 'https://i.pravatar.cc/150?u=me' },
      text: message.content,
      time: 'Just now',
    }

    if (!messagesState.value[activeTicketId.value]) messagesState.value[activeTicketId.value] = []
    messagesState.value[activeTicketId.value].push(newMessage)
    
    scrollToBottom()
  } catch (e) {
    replyMessage.value = text
    alert('Failed to send')
  } finally {
    isSending.value = false
  }
}

// --- 5. CREATE TICKET LOGIC ---
async function createTicket() {
  if (!newTicketForm.value.subject || !newTicketForm.value.message) return
  
  isCreating.value = true
  try {
    await $fetch('/api/support/create', {
      method: 'POST',
      body: newTicketForm.value
    })
    await refreshTickets()
    showNewTicketModal.value = false
    newTicketForm.value = { subject: '', category: 'Technical', priority: 'NORMAL', message: '' }
  } catch (e) {
    alert('Error creating ticket')
  } finally {
    isCreating.value = false
  }
}

// --- UTILS ---
function getPriorityStyles(p: string) {
  switch (p) {
    case 'High': return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: 'lucide:alert-circle' }
    case 'Medium': return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'lucide:clock' }
    default: return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'lucide:info' }
  }
}

function getStatusStyles(s: string) {
  switch (s) {
    case 'Open': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    case 'Pending': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
    case 'Closed': return 'bg-muted-500'
    default: return 'bg-blue-500'
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

// Select first ticket on load
onMounted(() => {
  if (tickets.value.length > 0 && !activeTicketId.value) {
    activeTicketId.value = tickets.value[0].id
  }
})
</script>

<template>
  <div class="w-full h-screen bg-[#0f111a] font-sans text-muted-100 p-4 md:p-6 lg:p-8 flex flex-col overflow-hidden relative">
    
    <div class="fixed inset-0 pointer-events-none -z-10">
      <div class="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px]" />
      <div class="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-[100px]" />
      <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-15 brightness-100 contrast-150" />
    </div>

    <div class="flex items-center justify-between mb-6 shrink-0 z-10">
      <div>
        <h1 class="text-3xl font-light text-white">
          Support <span class="font-bold text-[#6366f1]">Center</span>
        </h1>
        <p class="text-xs text-muted-500 mt-1">
          Real-time support and ticket management.
        </p>
      </div>
      <button @click="showNewTicketModal = true" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6366f1] hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/20 group">
        <Icon name="lucide:plus" class="w-4 h-4 group-hover:rotate-90 transition-transform" />
        <span>New Ticket</span>
      </button>
    </div>

    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 z-10">
      
      <div class="lg:col-span-4 flex flex-col gap-4 h-full min-h-0">
        <div class="bg-[#161925] border border-white/5 rounded-[1.5rem] p-4 shrink-0 shadow-xl">
          <div class="relative mb-4 group">
            <Icon name="lucide:search" class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-500 group-focus-within:text-primary-400 transition-colors" />
            <input
              v-model="searchQuery" type="text" placeholder="Search by ID, subject or customer..."
              class="w-full bg-[#0f111a] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-muted-600 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/50 transition-all"
            >
          </div>
          <div class="flex gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar">
            <button
              v-for="tab in filters" :key="tab"
              class="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border"
              :class="activeFilter === tab ? 'bg-white text-black border-white shadow-md' : 'bg-transparent text-muted-500 border-transparent hover:bg-white/5'"
              @click="activeFilter = tab"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 pb-2">
          <div v-if="filteredTickets.length === 0" class="text-center py-10 text-muted-500 text-xs">No tickets found.</div>

          <div
            v-for="ticket in filteredTickets" :key="ticket.id"
            class="group p-5 rounded-[1.25rem] border cursor-pointer transition-all duration-300 relative overflow-hidden"
            :class="activeTicketId === ticket.id ? 'bg-[#1c2130] border-primary-500/40 shadow-lg translate-x-1' : 'bg-[#161925] border-white/5 hover:border-white/10 hover:bg-[#1a1d29]'"
            @click="activeTicketId = ticket.id"
          >
            <div v-if="activeTicketId === ticket.id" class="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />

            <div class="flex justify-between items-center mb-2 pl-2">
              <span class="text-[10px] font-mono font-medium text-muted-500 tracking-wider flex items-center gap-1">
                {{ ticket.displayId }}
                <span v-if="ticket.customer.status === 'online'" class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </span>
              <span class="text-[10px] text-muted-500">{{ ticket.lastUpdate }}</span>
            </div>

            <h4 class="text-sm font-bold text-white mb-1.5 pl-2 truncate pr-2 group-hover:text-primary-400 transition-colors">
              {{ ticket.subject }}
            </h4>

            <div class="flex items-center gap-2 pl-2 mb-3">
              <img :src="ticket.customer.avatar || 'https://via.placeholder.com/30'" class="w-5 h-5 rounded-full border border-white/10" :alt="ticket.customer.name">
              <p class="text-[11px] text-muted-400 truncate w-full">
                {{ ticket.customer.name }}: {{ ticket.preview }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 pl-2">
              <span
                class="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase border flex items-center gap-1.5"
                :class="[getPriorityStyles(ticket.priority).bg, getPriorityStyles(ticket.priority).text, getPriorityStyles(ticket.priority).border]"
              >
                <Icon :name="getPriorityStyles(ticket.priority).icon" class="w-3 h-3" />
                {{ ticket.priority }}
              </span>
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5">
                <span class="w-1.5 h-1.5 rounded-full" :class="getStatusStyles(ticket.status)" />
                <span class="text-[9px] font-bold text-muted-400 uppercase">{{ ticket.status }}</span>
              </div>
              <span v-for="tag in ticket.tags" :key="tag" class="text-[9px] text-muted-500 px-1.5">#{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-8 flex flex-col h-full bg-[#161925] border border-white/5 rounded-[2rem] overflow-hidden relative shadow-2xl">
        <template v-if="selectedTicket">
          <div class="p-6 border-b border-white/5 flex justify-between items-start bg-[#1a1e2e]/80 backdrop-blur-md shrink-0 z-20">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <h2 class="text-lg md:text-xl font-bold text-white">
                  {{ selectedTicket.subject }}
                </h2>
                <div class="flex gap-2">
                  <span
                    class="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-[#0f111a]"
                    :class="[getPriorityStyles(selectedTicket.priority).text, getPriorityStyles(selectedTicket.priority).border]"
                  >
                    {{ selectedTicket.priority }}
                  </span>
                  <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase border bg-[#0f111a] border-white/10 text-muted-400">
                    {{ selectedTicket.category }}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 text-xs text-muted-400">
                <span>Assigned to:</span>
                <div v-if="selectedTicket.assignedAgent" class="flex items-center gap-1.5 text-white bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                  <img v-if="selectedTicket.assignedAgent.avatar" :src="selectedTicket.assignedAgent.avatar" class="w-4 h-4 rounded-full">
                  <span class="font-medium">{{ selectedTicket.assignedAgent.name }}</span>
                </div>
                <span v-else class="text-muted-500 italic">Unassigned</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-muted-400 hover:text-white transition-colors border border-white/5">
                <Icon name="lucide:more-vertical" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref="chatContainerRef" class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0f111a]/30">
            <div v-for="msg in selectedTicket.messages" :key="msg.id">
              <div v-if="msg.isSystem" class="flex justify-center my-4">
                <span class="text-[10px] font-bold text-muted-500 bg-white/5 px-3 py-1 rounded-full border border-white/5 uppercase tracking-wider flex items-center gap-2">
                  <Icon name="lucide:info" class="w-3 h-3" /> {{ msg.text }} • {{ msg.time }}
                </span>
              </div>

              <div v-else class="flex gap-4 max-w-[85%]" :class="msg.sender.role === 'user' ? 'ml-auto flex-row-reverse' : ''">
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 shadow-lg overflow-hidden"
                  :class="msg.sender.role === 'user' ? 'border-[#6366f1]/20' : 'border-white/10'"
                >
                  <img v-if="msg.sender.avatar" :src="msg.sender.avatar" class="w-full h-full object-cover">
                  <Icon v-else name="lucide:user" class="w-5 h-5 text-muted-400" />
                </div>

                <div class="flex flex-col" :class="msg.sender.role === 'user' ? 'items-end' : 'items-start'">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-[11px] font-bold text-white">{{ msg.sender.name }}</span>
                    <span class="text-[9px] text-muted-500">{{ msg.time }}</span>
                  </div>

                  <div
                    class="p-4 rounded-2xl text-sm leading-relaxed border shadow-md relative"
                    :class="msg.sender.role === 'user'
                      ? 'bg-[#6366f1] text-white rounded-tr-none border-[#6366f1]'
                      : 'bg-[#27272a] text-muted-200 rounded-tl-none border-white/5'"
                  >
                    {{ msg.text }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="p-4 border-t border-white/5 bg-[#1a1e2e] shrink-0 z-20">
            <div v-if="selectedTicket.status === 'Closed'" class="p-6 rounded-xl bg-white/5 border border-dashed border-white/10 text-center flex flex-col items-center justify-center gap-2">
              <Icon name="lucide:lock" class="w-5 h-5 text-muted-500" />
              <p class="text-xs text-muted-400 font-bold uppercase tracking-wider">This conversation is locked.</p>
            </div>

            <div v-else class="flex flex-col gap-3">
              <div class="relative group">
                <textarea
                  v-model="replyMessage"
                  :disabled="isSending"
                  rows="2"
                  placeholder="Type your reply here... (Press Enter to send)"
                  class="w-full bg-[#0f111a] border border-white/10 rounded-2xl pl-4 pr-16 py-4 text-sm text-white placeholder:text-muted-600 focus:border-primary-500/50 focus:outline-none transition-all resize-none shadow-inner disabled:opacity-50 disabled:cursor-not-allowed"
                  @keydown.enter.prevent="sendMessage"
                />
                <div class="absolute right-2 bottom-2 flex items-center gap-1">
                  <button
                    :disabled="isSending || !replyMessage.trim()" class="w-9 h-9 flex items-center justify-center rounded-xl bg-[#6366f1] hover:bg-indigo-600 text-white transition-all shadow-lg disabled:opacity-50 disabled:bg-gray-700"
                    @click="sendMessage"
                  >
                    <Icon v-if="!isSending" name="lucide:send" class="w-4 h-4" />
                    <Icon v-else name="lucide:loader-2" class="w-4 h-4 animate-spin" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="flex-1 flex flex-col items-center justify-center text-muted-500">
          <div class="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5 shadow-2xl">
            <Icon name="lucide:message-square-dashed" class="w-10 h-10 opacity-30" />
          </div>
          <h3 class="text-lg font-bold text-white mb-1">No Ticket Selected</h3>
          <p class="text-sm font-medium opacity-60">Select a ticket from the sidebar to view details</p>
        </div>
      </div>
    </div>

    <div v-if="showNewTicketModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div class="bg-[#161925] border border-white/10 rounded-3xl p-8 w-full max-w-lg shadow-2xl relative">
        <button @click="showNewTicketModal = false" class="absolute top-4 right-4 text-muted-500 hover:text-white"><Icon name="lucide:x" class="w-6 h-6" /></button>
        
        <h2 class="text-2xl font-bold text-white mb-6">Create New Ticket</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-muted-400 uppercase mb-2">Subject</label>
            <input v-model="newTicketForm.subject" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#6366f1] outline-none transition-all">
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted-400 uppercase mb-2">Category</label>
              <select v-model="newTicketForm.category" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#6366f1] outline-none appearance-none cursor-pointer">
                <option>Technical</option>
                <option>Billing</option>
                <option>Sales</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-muted-400 uppercase mb-2">Priority</label>
              <select v-model="newTicketForm.priority" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#6366f1] outline-none appearance-none cursor-pointer">
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-muted-400 uppercase mb-2">Message</label>
            <textarea v-model="newTicketForm.message" rows="4" class="w-full bg-[#0f111a] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#6366f1] outline-none resize-none"></textarea>
          </div>

          <button @click="createTicket" :disabled="isCreating" class="w-full py-4 rounded-xl bg-[#6366f1] hover:bg-indigo-600 text-white font-bold uppercase tracking-wider transition-all mt-2 flex items-center justify-center gap-2">
             <Icon v-if="isCreating" name="lucide:loader" class="w-4 h-4 animate-spin" />
             <span v-else>Submit Ticket</span>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.no-select { user-select: none; -webkit-user-select: none; }
.custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.05) transparent; scroll-behavior: smooth; overflow-y: overlay; }
.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.05); border-radius: 20px; border: 1px solid transparent; background-clip: content-box; }
.custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); }
.custom-scrollbar::-webkit-scrollbar-thumb:active { background-color: rgba(99, 102, 241, 0.4); }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
@keyframes slide-in-bottom { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
.group { animation: slide-in-bottom 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
.group:nth-child(1) { animation-delay: 0.05s; }
.group:nth-child(2) { animation-delay: 0.1s; }
.group:nth-child(3) { animation-delay: 0.15s; }
.group:nth-child(4) { animation-delay: 0.2s; }
.group:nth-child(5) { animation-delay: 0.25s; }
@keyframes message-pop { 0% { opacity: 0; transform: scale(0.95) translateY(5px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
.message-bubble { animation: message-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; transform-origin: bottom left; }
.message-bubble.own { transform-origin: bottom right; }
textarea { field-sizing: content; min-height: 52px; max-height: 150px; line-height: 1.5; resize: none; }
::selection { background: rgba(99, 102, 241, 0.3); color: #fff; }
@supports (height: 100dvh) { .h-screen { height: 100dvh; } }
@supports not (backdrop-filter: blur(12px)) { .backdrop-blur-md { background-color: rgba(26, 30, 46, 0.95); } }
.break-words { word-wrap: break-word; word-break: break-word; overflow-wrap: break-word; }
</style>