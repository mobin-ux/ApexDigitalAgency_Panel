<script setup lang="ts">
/**
 * Staff invitation acceptance — the other end of Phase 9's Team & access.
 *
 * An invite that cannot be accepted is a dead end, which is the pattern
 * Phases 3, 5 and 7 each removed, so the panel's "Invite a team member"
 * lands here. The link carries a single-use token; the name, address and
 * role all come from the invite row, never from this form — a page that
 * let you type your own role would be privilege escalation with a nice
 * layout.
 *
 * Built on the Phase 8 auth shell and its conventions: one shared layout,
 * a 10-character minimum, a strength meter, a show/hide toggle, and errors
 * inside the form column so a failure cannot move the page.
 */
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
  title: 'Accept your invitation',
})

/** Same minimum as signup, reset and Settings (Phase 8). */
const PASSWORD_MIN = 10

const route = useRoute()
const { fetchUser } = useUser()

const token = computed(() => (route.query.token as string) || '')

/*
 * Query params are available during SSR, so this resolves on the server
 * and the page never flashes a loading state (Phase 8 removed exactly that
 * from `recover.vue`). `immediate` guards the tokenless case, which is its
 * own screen rather than a request guaranteed to 400.
 */
const { data: invite, error: inviteError, pending } = await useFetch('/api/auth/invite', {
  query: computed(() => ({ token: token.value })),
  immediate: Boolean(token.value),
})

const validationSchema = toTypedSchema(
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

const { handleSubmit, isSubmitting, values } = useForm({ validationSchema })

const errorMessage = ref('')
const showPassword = ref(false)

const passwordScore = computed(() => {
  const v = (values as any).password ?? ''
  if (!v) {
    return 0
  }
  const varied = /[A-Z]/.test(v) && /\d/.test(v)
  if (v.length < PASSWORD_MIN) {
    return 1
  }
  if (v.length < 14) {
    return varied ? 3 : 2
  }
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

/** The API's own sentence wherever it has one — it explains the specific failure. */
const linkProblem = computed(() => {
  if (!token.value) {
    return 'This page needs the link from your invitation email.'
  }
  const err = inviteError.value as any
  if (!err) {
    return null
  }
  if (err.statusCode === 429) {
    return err?.data?.message || 'Too many attempts. Please wait a minute and try again.'
  }
  return err?.data?.message || 'This invitation is no longer valid. Ask whoever invited you to send a new one.'
})

const onSubmit = handleSubmit(async (formValues) => {
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/accept-invite', {
      method: 'POST',
      body: { token: token.value, password: formValues.password },
    })
    // The endpoint sets the session cookie, so refresh state and go
    // straight to the panel they were invited to.
    await fetchUser({ force: true })
    await navigateTo('/admin')
  }
  catch (error: any) {
    errorMessage.value = error?.statusCode === 429
      ? (error?.data?.message || 'Too many attempts. Please wait a minute and try again.')
      : (error?.data?.message || error?.statusMessage || 'We couldn\'t set up your account. The invitation may have expired.')
  }
})
</script>

<template>
  <div class="apex-fade">
    <!-- ================================= LINK MISSING OR NO LONGER VALID -->
    <div v-if="linkProblem" class="text-center">
      <span aria-hidden="true" class="mb-5 inline-flex size-[62px] items-center justify-center rounded-full bg-[#EC6453]/14 text-[#EC6453]">
        <Icon name="lucide:link-2-off" class="size-7" />
      </span>
      <h1 class="font-heading text-muted-900 text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] dark:text-white">
        This invitation can't be used
      </h1>
      <p class="text-muted-400 mt-3 text-[14.5px] leading-[1.6]">
        {{ linkProblem }}
      </p>
      <p class="mt-[22px] text-[13.5px]">
        <NuxtLink to="/auth/login-1" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
          Go to sign in
        </NuxtLink>
      </p>
    </div>

    <div v-else-if="pending" class="text-center">
      <div class="bg-muted-100 dark:bg-muted-800 mx-auto h-8 w-56 animate-pulse rounded-lg" />
      <div class="bg-muted-100 dark:bg-muted-800 mx-auto mt-4 h-4 w-72 animate-pulse rounded" />
    </div>

    <!-- ============================================================ FORM -->
    <div v-else-if="invite">
      <h1 class="font-heading text-muted-900 text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] dark:text-white">
        Welcome, {{ invite.name.split(' ')[0] }}
      </h1>
      <p class="text-muted-400 mt-2.5 text-[14.5px] leading-[1.6]">
        Choose a password and your Apex staff account is ready. Your sign-in address is
        <strong class="text-muted-900 font-semibold dark:text-white">{{ invite.email }}</strong>.
      </p>

      <!--
        The role is stated, not offered. It was chosen by whoever invited
        them and is read from the invite row server-side; showing it here
        means nobody discovers their own access level by trial and error.
      -->
      <div class="border-muted-200 bg-muted-100 dark:bg-muted-800 mt-5 flex items-start gap-3 rounded-xl border px-[15px] py-[13px] dark:border-white/8">
        <Icon name="lucide:shield-check" class="text-primary-400 mt-px size-[18px] shrink-0" />
        <span class="flex-1 text-[13px] leading-[1.55]">
          <span class="text-muted-900 block font-semibold dark:text-white">You've been invited as {{ invite.role }}</span>
          <span v-if="invite.covers" class="text-muted-400 mt-0.5 block">That covers {{ invite.covers }}.</span>
        </span>
      </div>

      <div
        v-if="errorMessage"
        role="alert"
        class="mt-5 flex items-start gap-2.5 rounded-xl border border-[#EC6453]/32 bg-[#EC6453]/10 px-[15px] py-[13px]"
      >
        <Icon name="lucide:alert-triangle" class="mt-px size-[17px] shrink-0 text-[#EC6453]" />
        <span class="text-muted-900 flex-1 text-[13px] leading-[1.5] dark:text-white">{{ errorMessage }}</span>
      </div>

      <form novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
        <Field v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="password">
          <div class="relative">
            <BaseField
              v-slot="{ inputAttrs, inputRef }"
              label="Choose a password"
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
            label="Confirm password"
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
              placeholder="Type it again"
              rounded="lg"
              class="h-[46px]! rounded-xl!"
              @update:model-value="handleChange"
              @blur="handleBlur"
            />
          </BaseField>
        </Field>

        <BaseButton
          type="submit"
          variant="primary"
          rounded="full"
          :loading="isSubmitting"
          :disabled="isSubmitting"
          class="mt-1 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
        >
          Create my account
        </BaseButton>
      </form>

      <p class="text-muted-500 mt-5 text-[12.5px] leading-[1.55]">
        This link works once. If you did not expect this invitation, ignore it — no account is created until you set a password.
      </p>
    </div>
  </div>
</template>
