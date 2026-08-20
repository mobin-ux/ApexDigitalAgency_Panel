<script setup lang="ts">
/**
 * Password reset — Apex Design V2, Phase 8. Two modes in one route:
 *
 *   /auth/recover              → request a link
 *   /auth/recover?token=…      → set a new password
 *
 * Endpoints unchanged: POST /api/auth/reset-password-request and
 * /api/auth/reset-password-confirm. The request endpoint deliberately answers
 * the same way whether or not the address is registered, so the copy here
 * keeps the "if an account exists" phrasing rather than confirming it.
 *
 * The page no longer sits inside `<ClientOnly>`. It was wrapped because
 * `isResetMode` reads `route.query.token`, but query params are available
 * during SSR — the wrapper bought nothing and cost every visitor a flash of
 * the word "Loading...".
 */
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
  title: 'Reset password',
})

/** Same minimum as signup and Settings. */
const PASSWORD_MIN = 10

/** The API sets `expiresAt` to one hour; say so rather than leaving them guessing. */
const LINK_EXPIRY = '60 minutes'

const route = useRoute()
const router = useRouter()

const token = computed(() => (route.query.token as string) || '')
const isResetMode = computed(() => Boolean(token.value))

const requestSchema = toTypedSchema(
  z.object({
    email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
  }),
)

const resetSchema = toTypedSchema(
  z
    .object({
      password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`),
      confirmPassword: z.string(),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
)

const validationSchema = computed(() => (isResetMode.value ? resetSchema : requestSchema))

const { handleSubmit, isSubmitting, values } = useForm({ validationSchema })

const linkSent = ref(false)
const passwordChanged = ref(false)
const sentTo = ref('')
const errorMessage = ref('')
const showPassword = ref(false)
const resending = ref(false)

/** Strength meter — the reset screen is exactly where it was missing. */
const passwordScore = computed(() => {
  const v = (values as any).password ?? ''
  if (!v)
    return 0
  const varied = /[A-Z]/.test(v) && /\d/.test(v)
  if (v.length < PASSWORD_MIN)
    return 1
  if (v.length < 14)
    return varied ? 3 : 2
  return varied ? 4 : 3
})
const STRENGTH = [
  { width: '0%', bar: 'bg-transparent', text: 'text-muted-500', label: '' },
  { width: '25%', bar: 'bg-[#EC6453]', text: 'text-[#EC6453]', label: 'Too short' },
  { width: '50%', bar: 'bg-[#F2C14E]', text: 'text-[#F2C14E]', label: 'Weak' },
  { width: '75%', bar: 'bg-[#F2C14E]', text: 'text-[#F2C14E]', label: 'Good' },
  { width: '100%', bar: 'bg-[#22B07D]', text: 'text-[#22B07D]', label: 'Strong' },
] as const
const strength = computed(() => STRENGTH[passwordScore.value] ?? STRENGTH[0]!)

function describeError(error: any, fallback: string) {
  if (error?.statusCode === 429) {
    return error?.data?.message || 'Too many requests. Please wait a minute and try again.'
  }
  return error?.data?.message || error?.statusMessage || fallback
}

async function requestLink(email: string) {
  await $fetch('/api/auth/reset-password-request', { method: 'POST', body: { email } })
  sentTo.value = email
  linkSent.value = true
}

const onSubmit = handleSubmit(async (formValues: any) => {
  errorMessage.value = ''
  try {
    if (isResetMode.value) {
      await $fetch('/api/auth/reset-password-confirm', {
        method: 'POST',
        body: { token: token.value, newPassword: formValues.password },
      })
      // Confirm before leaving. The old flow pushed straight to sign-in, so
      // the customer arrived with no idea whether anything had changed.
      passwordChanged.value = true
    }
    else {
      await requestLink(formValues.email)
    }
  }
  catch (error: any) {
    errorMessage.value = describeError(
      error,
      isResetMode.value
        ? 'We couldn\'t update your password. The link may have expired — request a new one.'
        : 'We couldn\'t send the link. Please try again.',
    )
  }
})

/** A lost email used to be a dead end: there was no way to ask for another. */
async function resend() {
  if (!sentTo.value || resending.value)
    return
  resending.value = true
  errorMessage.value = ''
  try {
    await requestLink(sentTo.value)
  }
  catch (error: any) {
    errorMessage.value = describeError(error, 'We couldn\'t send the link again. Please try later.')
  }
  finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="apex-fade">
    <!-- ============================================ NEW PASSWORD: SUCCESS -->
    <div v-if="passwordChanged" class="text-center">
      <span class="mb-5 inline-flex size-[62px] items-center justify-center rounded-full bg-[#22B07D]/14 text-[#22B07D]">
        <Icon name="lucide:check" class="size-7" />
      </span>
      <h1 class="font-heading text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-muted-900 dark:text-white">
        Password changed
      </h1>
      <p class="text-muted-400 mt-3 text-[14.5px] leading-[1.6]">
        You can sign in with your new password now.
      </p>
      <BaseButton
        to="/auth/login-1"
        variant="primary"
        rounded="full"
        class="mt-6 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
      >
        Go to sign in
      </BaseButton>
    </div>

    <!-- ============================================== REQUEST: LINK SENT -->
    <div v-else-if="linkSent" class="text-center">
      <span class="mb-5 inline-flex size-[62px] items-center justify-center rounded-full bg-[#22B07D]/14 text-[#22B07D]">
        <Icon name="lucide:mail" class="size-7" />
      </span>
      <h1 class="font-heading text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-muted-900 dark:text-white">
        Check your inbox
      </h1>
      <!-- Neutral on purpose: the endpoint answers identically for unknown
           addresses, and this sentence must not undo that. -->
      <p class="text-muted-400 mt-3 text-[14.5px] leading-[1.6]">
        If an account exists for <strong class="font-semibold text-muted-900 dark:text-white">{{ sentTo }}</strong>, we've sent a link to reset your password. It expires in {{ LINK_EXPIRY }}.
      </p>

      <div class="mt-5 flex items-start gap-2.5 rounded-xl border border-muted-200 dark:border-white/8 bg-muted-100 dark:bg-muted-800 px-[15px] py-[13px] text-start">
        <Icon name="lucide:info" class="text-muted-500 mt-px size-[17px] shrink-0" />
        <span class="text-muted-400 flex-1 text-[12.5px] leading-[1.5]">
          Nothing after a few minutes? Check your spam folder, or
          <button
            type="button"
            :disabled="resending"
            class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold disabled:opacity-60"
            @click="resend"
          >{{ resending ? 'sending…' : 'send it again' }}</button>.
        </span>
      </div>

      <div v-if="errorMessage" role="alert" class="mt-4 rounded-xl border border-[#EC6453]/32 bg-[#EC6453]/10 px-[15px] py-[13px] text-start text-[13px] text-muted-900 dark:text-white">
        {{ errorMessage }}
      </div>

      <p class="mt-[22px] text-[13.5px]">
        <NuxtLink to="/auth/login-1" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
          Back to sign in
        </NuxtLink>
      </p>
    </div>

    <!-- ================================================== FORM (BOTH MODES) -->
    <div v-else>
      <h1 class="font-heading text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-muted-900 dark:text-white">
        {{ isResetMode ? 'Set a new password' : 'Reset your password' }}
      </h1>
      <p class="text-muted-400 mt-2.5 text-[14.5px] leading-[1.6]">
        {{ isResetMode
          ? `Choose something you haven't used before — at least ${PASSWORD_MIN} characters.`
          : 'Enter the email on your account and we\'ll send you a link.' }}
      </p>

      <div
        v-if="errorMessage"
        role="alert"
        class="mt-5 flex items-start gap-2.5 rounded-xl border border-[#EC6453]/32 bg-[#EC6453]/10 px-[15px] py-[13px]"
      >
        <Icon name="lucide:alert-triangle" class="mt-px size-[17px] shrink-0 text-[#EC6453]" />
        <span class="flex-1 text-[13px] leading-[1.5] text-muted-900 dark:text-white">{{ errorMessage }}</span>
      </div>

      <form novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
        <Field v-if="!isResetMode" v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="email">
          <BaseField
            v-slot="{ inputAttrs, inputRef }"
            label="Email address"
            :state="fieldError ? 'error' : 'idle'"
            :error="fieldError"
            :disabled="isSubmitting"
          >
            <!-- `type="email"` so the mobile keyboard adapts; it only ever
                 validated as an email in Zod. -->
            <BaseInput
              :ref="inputRef"
              v-bind="inputAttrs"
              :model-value="field.value"
              type="email"
              autocomplete="email"
              placeholder="you@company.co.uk"
              rounded="lg"
              class="h-[46px]! rounded-xl!"
              @update:model-value="handleChange"
              @blur="handleBlur"
            />
          </BaseField>
        </Field>

        <template v-else>
          <Field v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="password">
            <div class="relative">
              <BaseField
                v-slot="{ inputAttrs, inputRef }"
                label="New password"
                :state="fieldError ? 'error' : 'idle'"
                :error="fieldError"
                :disabled="isSubmitting"
              >
                <BaseInput
                  :ref="inputRef"
                  v-bind="inputAttrs"
                  :model-value="field.value"
                  :type="showPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :placeholder="`At least ${PASSWORD_MIN} characters`"
                  rounded="lg"
                  class="h-[46px]! rounded-xl! pe-12!"
                  @update:model-value="handleChange"
                  @blur="handleBlur"
                />
              </BaseField>
              <button
                type="button"
                :aria-pressed="showPassword"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                class="apex-focus text-muted-500 hover:text-muted-300 absolute end-[5px] top-[30px] inline-flex size-9 items-center justify-center rounded-lg"
                @click="showPassword = !showPassword"
              >
                <Icon :name="showPassword ? 'lucide:eye-off' : 'lucide:eye'" class="size-[18px]" />
              </button>
            </div>
          </Field>

          <div v-if="(values as any).password" class="-mt-1 flex items-center gap-2.5">
            <span class="bg-muted-100 dark:bg-muted-800 h-[5px] flex-1 overflow-hidden rounded-full">
              <span class="block h-full rounded-full transition-all" :class="strength.bar" :style="{ width: strength.width }" />
            </span>
            <span class="min-w-[64px] text-end text-[11.5px] font-semibold" :class="strength.text">{{ strength.label }}</span>
          </div>

          <Field v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="confirmPassword">
            <BaseField
              v-slot="{ inputAttrs, inputRef }"
              label="Confirm new password"
              :state="fieldError ? 'error' : 'idle'"
              :error="fieldError"
              :disabled="isSubmitting"
            >
              <BaseInput
                :ref="inputRef"
                v-bind="inputAttrs"
                :model-value="field.value"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                placeholder="Re-enter it"
                rounded="lg"
                class="h-[46px]! rounded-xl!"
                @update:model-value="handleChange"
                @blur="handleBlur"
              />
            </BaseField>
          </Field>
        </template>

        <BaseButton
          type="submit"
          variant="primary"
          rounded="full"
          :disabled="isSubmitting"
          :loading="isSubmitting"
          class="mt-2 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
        >
          {{ isResetMode ? 'Update password' : 'Send reset link' }}
        </BaseButton>
      </form>

      <p class="mt-[22px] text-center text-[13.5px]">
        <NuxtLink to="/auth/login-1" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
          Back to sign in
        </NuxtLink>
      </p>
    </div>
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
