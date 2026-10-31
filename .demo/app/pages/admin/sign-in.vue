<script setup lang="ts">
/**
 * Staff sign-in for the admin console (ADR-025).
 *
 * Separate from the customer sign-in on purpose: it accepts only staff
 * accounts, always asks for a code from an authenticator app, and starts
 * the only kind of session the admin API takes (twelve hours at most, two
 * idle). A staff account without two-step is walked through setting it up
 * here, before it gets a session at all, and shown its backup codes once.
 *
 *   password → code               POST /api/admin/auth/login, …/login-2fa
 *   password → set up → codes     POST /api/admin/auth/login, …/enrol/start, …/enrol/finish
 *
 * The staff cookie is SameSite=Strict, so a link to /admin from an email
 * arrives here without it; the check on mount finds the session and carries
 * on to where the link pointed.
 */

definePageMeta({
  layout: 'auth',
  title: 'Staff sign-in',
  middleware: [
    async (to) => {
      const { user, fetchUser } = useUser()
      if (!user.value) {
        await fetchUser().catch(() => {})
      }
      if (user.value?.sessionKind === 'staff') {
        return navigateTo(adminDestination(to.query.redirect, user.value.staffRole))
      }
    },
  ],
})

type Step = 'password' | 'code' | 'enrol' | 'codes'

const route = useRoute()
const { user, fetchUser } = useUser()
const { data: config } = useApexConfig()
const supportEmail = computed(() => (config.value as any)?.supportEmail as string | undefined)

const step = ref<Step>('password')
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const showPassword = ref(false)
const ticket = ref('')
const code = ref('')
const useBackup = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const setup = ref<{ secret: string, uri: string } | null>(null)
const backupCodes = ref<string[]>([])
const codesCopied = ref(false)
const formRef = ref<HTMLFormElement | null>(null)

const qr = computed(() => (setup.value ? qrPath(setup.value.uri) : null))
const secretGroups = computed(() => groupSecret(setup.value?.secret))
const codeReady = computed(() => useBackup.value
  ? code.value.replace(/[^a-z0-9]/gi, '').length === 10
  : /^\d{6}$/.test(code.value.replace(/\s/g, '')))

const TITLES: Record<Step, string> = {
  password: 'Staff sign-in',
  code: 'Enter your code',
  enrol: 'Set up two-step verification',
  codes: 'Save your backup codes',
}
const SUBTITLES: Record<Step, string> = {
  password: 'The Apex admin console. Client accounts sign in on the client sign-in.',
  code: 'Open your authenticator app and type the six-digit code for Apex Digi.',
  enrol: 'The admin console asks for a code from an authenticator app every time you sign in. Add your account to the app once, here.',
  codes: 'If you lose your phone, each of these codes signs you in once. This is the only time they are shown.',
}

function failure(error: any, fallback: string): string {
  return error?.data?.message || (error?.statusCode === 429 ? 'Too many attempts. Please wait and try again.' : fallback)
}

async function focusFirst() {
  await nextTick()
  formRef.value?.querySelector<HTMLInputElement>('input:not([type=hidden])')?.focus()
}

async function submitPassword() {
  if (busy.value || !email.value.trim() || !password.value) {
    errorMessage.value = !email.value.trim() || !password.value ? 'Enter your email address and password.' : ''
    return
  }
  errorMessage.value = ''
  busy.value = true
  try {
    const res = await $fetch('/api/admin/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    ticket.value = res.ticket
    password.value = ''
    code.value = ''
    useBackup.value = false
    if (res.status === 'two_factor') {
      step.value = 'code'
    }
    else {
      setup.value = await $fetch<{ secret: string, uri: string }>('/api/admin/auth/enrol/start', { method: 'POST', body: { ticket: ticket.value } })
      step.value = 'enrol'
    }
    await focusFirst()
  }
  catch (error: any) {
    errorMessage.value = failure(error, 'We couldn\'t sign you in. Check your details and try again.')
  }
  finally {
    busy.value = false
  }
}

async function submitCode() {
  if (!codeReady.value || busy.value) {
    return
  }
  errorMessage.value = ''
  busy.value = true
  try {
    if (step.value === 'enrol') {
      const res = await $fetch('/api/admin/auth/enrol/finish', { method: 'POST', body: { ticket: ticket.value, code: code.value } })
      backupCodes.value = res.backupCodes
      step.value = 'codes'
      return
    }
    await $fetch('/api/admin/auth/login-2fa', { method: 'POST', body: { ticket: ticket.value, code: code.value } })
    await finish()
  }
  catch (error: any) {
    if (error?.statusCode === 401) {
      // The ticket ran out: back to the password.
      restart()
    }
    errorMessage.value = failure(error, 'That code did not work. Try again.')
  }
  finally {
    busy.value = false
  }
}

async function finish() {
  await fetchUser({ force: true })
  await navigateTo(adminDestination(route.query.redirect, user.value?.staffRole))
}

function restart() {
  step.value = 'password'
  ticket.value = ''
  setup.value = null
  code.value = ''
  focusFirst()
}

function switchCodeKind() {
  useBackup.value = !useBackup.value
  code.value = ''
  errorMessage.value = ''
  focusFirst()
}

async function copyCodes() {
  try {
    await navigator.clipboard.writeText(backupCodes.value.join('\n'))
    codesCopied.value = true
  }
  catch {
    errorMessage.value = 'Copying was blocked by the browser. Select the codes and copy them, or download them.'
  }
}

function downloadCodes() {
  const text = `Apex Digi admin console backup codes\nEach code works once.\n\n${backupCodes.value.join('\n')}\n`
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'apex-admin-backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  // A cross-site link arrives without the SameSite=Strict cookie; this
  // same-origin request carries it, and finds a session the SSR could not.
  if (!user.value) {
    await fetchUser({ force: true }).catch(() => {})
    if (user.value?.sessionKind === 'staff') {
      await navigateTo(adminDestination(route.query.redirect, user.value.staffRole))
      return
    }
  }
  focusFirst()
})
</script>

<template>
  <div class="apex-fade">
    <p class="text-primary-400 mb-2 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em]">
      <Icon name="lucide:shield-check" class="size-[15px]" aria-hidden="true" />Admin console
    </p>
    <h1 class="font-heading text-muted-900 text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] dark:text-white">
      {{ TITLES[step] }}
    </h1>
    <p class="text-muted-400 mt-2.5 text-[14.5px] leading-[1.55]">
      {{ step === 'code' && useBackup ? 'Type one of the backup codes you saved when you set up two-step verification. Each one works once.' : SUBTITLES[step] }}
    </p>

    <div
      v-if="errorMessage"
      role="alert"
      class="mt-5 flex items-start gap-2.5 rounded-xl border border-[#EC6453]/32 bg-[#EC6453]/10 px-[15px] py-[13px]"
    >
      <Icon name="lucide:alert-triangle" class="mt-px size-[17px] shrink-0 text-[#EC6453]" />
      <span class="text-muted-900 flex-1 text-[13px] leading-[1.5] dark:text-white">{{ errorMessage }}</span>
    </div>

    <!-- ============================================================ PASSWORD -->
    <form v-if="step === 'password'" ref="formRef" novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="submitPassword">
      <div>
        <label for="staff-email" class="text-muted-900 mb-2 block text-[12.5px] font-semibold dark:text-white">Work email</label>
        <input
          id="staff-email"
          v-model="email"
          type="email"
          autocomplete="username"
          placeholder="you@apexdigi.co.uk"
          :disabled="busy"
          class="apex-focus border-muted-300 text-muted-900 focus:border-primary-500 dark:bg-muted-800 h-[46px] w-full rounded-xl border bg-white px-4 text-[16px] outline-none dark:border-white/10 dark:text-white"
        >
      </div>
      <div>
        <div class="mb-2 flex items-baseline justify-between gap-3">
          <label for="staff-password" class="text-muted-900 text-[12.5px] font-semibold dark:text-white">Password</label>
          <NuxtLink to="/auth/recover" class="apex-focus text-primary-400 hover:text-primary-300 rounded text-[12.5px] font-semibold">
            Forgot password?
          </NuxtLink>
        </div>
        <div class="relative">
          <input
            id="staff-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="busy"
            class="apex-focus border-muted-300 text-muted-900 focus:border-primary-500 dark:bg-muted-800 h-[46px] w-full rounded-xl border bg-white pe-12 ps-4 text-[16px] outline-none dark:border-white/10 dark:text-white"
          >
          <button
            type="button"
            :aria-pressed="showPassword"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            class="apex-focus text-muted-500 hover:text-muted-300 absolute end-[5px] top-[5px] inline-flex size-9 items-center justify-center rounded-lg"
            @click="showPassword = !showPassword"
          >
            <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="size-[18px]" />
          </button>
        </div>
      </div>
      <BaseButton type="submit" variant="primary" rounded="full" :disabled="busy" :loading="busy" class="mt-2 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]">
        Continue
      </BaseButton>
    </form>

    <!-- ============================================================ SET UP -->
    <div v-if="step === 'enrol'" class="mt-6 flex flex-col gap-4">
      <ol class="text-muted-400 m-0 flex list-decimal flex-col gap-1.5 ps-5 text-[14px] leading-[1.55]">
        <li>Open an authenticator app, such as Google Authenticator, Microsoft Authenticator or 1Password.</li>
        <li>Scan this code, or enter the key below.</li>
        <li>Type the six-digit code the app shows.</li>
      </ol>
      <div v-if="qr" class="flex justify-center">
        <svg :viewBox="`-4 -4 ${qr.size + 8} ${qr.size + 8}`" class="size-[184px] rounded-xl bg-white" role="img" aria-label="QR code for your authenticator app" shape-rendering="crispEdges">
          <path :d="qr.d" fill="#101828" />
        </svg>
      </div>
      <div class="dark:bg-muted-800 bg-muted-100 flex flex-col gap-1 rounded-xl px-3.5 py-3">
        <span class="text-muted-400 text-[12px] font-semibold">Key, if you cannot scan</span>
        <code class="text-muted-900 select-all break-all font-mono text-[14px] tracking-[0.04em] dark:text-white">{{ secretGroups }}</code>
      </div>
    </div>

    <!-- ============================================================ CODE -->
    <form v-if="step === 'code' || step === 'enrol'" ref="formRef" novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="submitCode">
      <div>
        <label for="staff-code" class="text-muted-900 mb-2 block text-[12.5px] font-semibold dark:text-white">{{ useBackup ? 'Backup code' : 'Six-digit code' }}</label>
        <input
          id="staff-code"
          v-model="code"
          :inputmode="useBackup ? 'text' : 'numeric'"
          autocomplete="one-time-code"
          :maxlength="useBackup ? 11 : 7"
          :placeholder="useBackup ? 'xxxxx-xxxxx' : '123 456'"
          :disabled="busy"
          class="apex-focus border-muted-300 text-muted-900 focus:border-primary-500 dark:bg-muted-800 h-[46px] w-full rounded-xl border bg-white px-4 font-mono text-[16px] tracking-[0.12em] outline-none dark:border-white/10 dark:text-white"
        >
      </div>
      <BaseButton type="submit" variant="primary" rounded="full" :disabled="!codeReady || busy" :loading="busy" class="mt-2 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]">
        {{ step === 'enrol' ? 'Turn on and continue' : 'Sign in' }}
      </BaseButton>
      <div class="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <button v-if="step === 'code'" type="button" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold" @click="switchCodeKind">
          {{ useBackup ? 'Use the code from my app' : 'Use a backup code instead' }}
        </button>
        <span v-else />
        <button type="button" class="apex-focus text-muted-400 hover:text-muted-900 rounded font-semibold dark:hover:text-white" @click="restart">
          Back
        </button>
      </div>
      <p v-if="step === 'code'" class="text-muted-400 m-0 text-[12.5px] leading-[1.55]">
        Lost your phone and your backup codes? An owner or admin can reset two-step for you from your record in Clients<template v-if="supportEmail">
          , or email <a :href="`mailto:${supportEmail}`" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">{{ supportEmail }}</a>
        </template>.
      </p>
    </form>

    <!-- ============================================================ BACKUP CODES -->
    <div v-if="step === 'codes'" class="mt-6 flex flex-col gap-4">
      <ul class="dark:bg-muted-800 bg-muted-100 m-0 grid list-none grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl p-4 font-mono text-[14.5px]" aria-label="Backup codes">
        <li v-for="c in backupCodes" :key="c" class="text-muted-900 select-all dark:text-white">
          {{ c }}
        </li>
      </ul>
      <div class="flex flex-wrap gap-2.5">
        <BaseButton variant="muted" rounded="full" size="sm" @click="copyCodes">
          {{ codesCopied ? 'Copied' : 'Copy codes' }}
        </BaseButton>
        <BaseButton variant="muted" rounded="full" size="sm" @click="downloadCodes">
          Download
        </BaseButton>
      </div>
      <BaseButton variant="primary" rounded="full" class="h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]" @click="finish">
        I have saved them
      </BaseButton>
    </div>

    <p v-if="step === 'password'" class="text-muted-400 mt-[22px] text-center text-[13.5px]">
      A client of Apex?
      <NuxtLink to="/auth/login-1" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
        Client sign-in
      </NuxtLink>
    </p>
  </div>
</template>

<style scoped>
.apex-fade {
  animation: apexFade 0.2s both;
}
@keyframes apexFade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .apex-fade {
    animation: none;
  }
}
</style>
