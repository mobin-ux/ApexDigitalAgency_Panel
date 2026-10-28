<script setup lang="ts">
/**
 * The link in the verification email (ADR-022): /auth/verify-email?token=…
 *
 * Posts the token once the page has mounted (a confirmation is a write,
 * so it is not done during the server render) and says what happened:
 * confirmed, already confirmed, or a link that is invalid or expired. A
 * signed-in person can ask for a new link from here; anyone else is sent
 * to sign in, where the panel's banner offers it.
 */
definePageMeta({
  layout: 'auth',
  title: 'Confirm your email',
})

const route = useRoute()
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const { user, fetchUser } = useUser()
const toaster = useNuiToasts()

const state = ref<'checking' | 'verified' | 'invalid' | 'missing'>(token.value ? 'checking' : 'missing')
const already = ref(false)
const errorMessage = ref('')

onMounted(async () => {
  if (!token.value) {
    return
  }
  try {
    const result = await $fetch('/api/auth/verify-email', { method: 'POST', body: { token: token.value } })
    already.value = Boolean(result.already)
    state.value = 'verified'
    if (user.value) {
      await fetchUser({ force: true })
    }
  }
  catch (error: any) {
    state.value = 'invalid'
    errorMessage.value = error?.data?.message || error?.statusMessage || 'This link is not valid or has expired.'
  }
})

const resending = ref(false)
async function resend() {
  if (resending.value) {
    return
  }
  resending.value = true
  try {
    const result = await $fetch('/api/auth/verify-email/request', { method: 'POST' })
    if (result.verified) {
      state.value = 'verified'
      already.value = true
      return
    }
    if (result.mail?.status === 'SENT') {
      toaster.add({ title: 'New link sent', description: `Check ${user.value?.email}.`, icon: 'lucide:mail', progress: true })
    }
    else {
      toaster.add({ title: 'Could not send the link', description: result.mail?.error || 'It is queued; try again in a minute.', icon: 'lucide:circle-alert', progress: true })
    }
  }
  catch (error: any) {
    toaster.add({ title: 'Could not send the link', description: error?.data?.message || 'Please try again later.', icon: 'lucide:circle-alert', progress: true })
  }
  finally {
    resending.value = false
  }
}

const H1 = 'font-heading text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-muted-900 dark:text-white'
const P = 'text-muted-400 mt-3 text-[14.5px] leading-[1.6]'
</script>

<template>
  <div class="apex-fade text-center">
    <template v-if="state === 'checking'">
      <span class="mb-5 inline-flex size-[62px] items-center justify-center rounded-full bg-primary-500/14 text-primary-400">
        <Icon name="lucide:loader-circle" class="size-7 motion-safe:animate-spin" />
      </span>
      <h1 :class="H1">
        Confirming your email…
      </h1>
      <p :class="P">
        One moment.
      </p>
    </template>

    <template v-else-if="state === 'verified'">
      <span class="mb-5 inline-flex size-[62px] items-center justify-center rounded-full bg-[#22B07D]/14 text-[#22B07D]">
        <Icon name="lucide:check" class="size-7" />
      </span>
      <h1 :class="H1">
        {{ already ? 'Already confirmed' : 'Email confirmed' }}
      </h1>
      <p :class="P">
        {{ already ? 'This address was confirmed earlier. Nothing else to do.' : 'Thanks. We can reach you about your projects at this address now.' }}
      </p>
      <BaseButton
        :to="user ? '/dashboards/balance' : '/auth/login-1'"
        variant="primary"
        rounded="full"
        class="mt-6 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
      >
        {{ user ? 'Go to your dashboard' : 'Sign in' }}
      </BaseButton>
    </template>

    <template v-else>
      <span class="mb-5 inline-flex size-[62px] items-center justify-center rounded-full bg-[#EC6453]/14 text-[#EC6453]">
        <Icon name="lucide:link-2-off" class="size-7" />
      </span>
      <h1 :class="H1">
        {{ state === 'missing' ? 'No link to check' : 'This link does not work' }}
      </h1>
      <p :class="P">
        {{ state === 'missing' ? 'Open the link from your confirmation email, or ask for a new one from the panel.' : errorMessage }}
      </p>
      <BaseButton
        v-if="user?.email && !user?.verifiedAt"
        variant="primary"
        rounded="full"
        class="mt-6 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
        :loading="resending"
        :disabled="resending"
        @click="resend"
      >
        Send a new link to {{ user.email }}
      </BaseButton>
      <p class="mt-[22px] text-[13.5px]">
        <NuxtLink :to="user ? '/dashboards/balance' : '/auth/login-1'" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
          {{ user ? 'Back to your dashboard' : 'Sign in' }}
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
