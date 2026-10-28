<script setup lang="ts">
/**
 * Soft email verification (ADR-022): one line above the customer pages
 * while the account's address is unconfirmed. Shown only when the panel
 * can actually send (`features.mail`), the account has an email and
 * `verifiedAt` is null; nothing is blocked. "Send again" asks for a new
 * link; "Hide" keeps it away for this browser session. The dismissal
 * resolves after mount so the server and the first client render agree.
 */
const props = defineProps<{ mailAvailable: boolean }>()

const { user } = useUser()
const toaster = useNuiToasts()

const KEY = 'apex:verify-email-banner'
const dismissed = ref(false)
onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(KEY) === '1'
  }
  catch {
    dismissed.value = false
  }
})

const show = computed(() => props.mailAvailable && Boolean(user.value?.email) && !user.value?.verifiedAt && !dismissed.value)

function dismiss() {
  dismissed.value = true
  try {
    sessionStorage.setItem(KEY, '1')
  }
  catch {
    // Private mode: it comes back next visit, which is acceptable.
  }
}

const sending = ref(false)
async function resend() {
  if (sending.value) {
    return
  }
  sending.value = true
  try {
    const result = await $fetch('/api/auth/verify-email/request', { method: 'POST' })
    if (result.verified) {
      user.value = { ...user.value, verifiedAt: new Date().toISOString() }
      return
    }
    if (result.mail?.status === 'SENT') {
      toaster.add({ title: 'Link sent', description: `Check ${user.value?.email}.`, icon: 'lucide:mail', progress: true })
    }
    else {
      toaster.add({ title: 'Could not send the link', description: result.mail?.error || 'It is queued; try again in a minute.', icon: 'lucide:circle-alert', progress: true })
    }
  }
  catch (error: any) {
    toaster.add({ title: 'Could not send the link', description: error?.data?.message || 'Please try again later.', icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    sending.value = false
  }
}
</script>

<template>
  <div
    v-if="show"
    role="status"
    class="bg-st-info-bg text-st-info-fg mx-[clamp(16px,3vw,40px)] mt-5 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-[13px] leading-normal"
  >
    <Icon name="lucide:mail" class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      Confirm your email address. We sent a link to <strong class="font-semibold">{{ user.email }}</strong>; open it to finish setting up your account.
    </span>
    <button type="button" class="apex-focus rounded-lg font-semibold underline underline-offset-2 disabled:opacity-60" :disabled="sending" @click="resend">
      {{ sending ? 'Sending…' : 'Send again' }}
    </button>
    <button type="button" class="apex-focus -m-1 shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100" aria-label="Hide for now" @click="dismiss">
      <Icon name="lucide:x" class="size-4" />
    </button>
  </div>
</template>
