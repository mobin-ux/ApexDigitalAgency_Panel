<script setup lang="ts">
/**
 * Create account — Apex Design V2, Phase 8.
 *
 * POST /api/auth/signup is unchanged. It already accepted an optional `name`
 * alongside the identifier and password; the page simply never sent one,
 * which is why the endpoint fell back to the email local part and the
 * dashboard greeted people as "mobin.gh505". Asking once here also fills the
 * sidebar, the avatar initials, the Settings name fields and the author name
 * on support messages.
 *
 * The client-side `looksLikeIdentifier` mirror of the server's
 * `parseIdentifier` heuristic is good and stays — the server re-validates.
 */
import type { AddonInputPassword } from '#components'
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
  title: 'Create account',
})

/**
 * One password policy across signup, reset and Settings. The API still
 * accepts 8 — a stricter client is always compatible, and raising the server
 * minimum would lock out existing accounts.
 */
const PASSWORD_MIN = 10

const VALIDATION_TEXT = {
  NAME_REQUIRED: 'Tell us what to call you',
  IDENTIFIER_REQUIRED: 'An email address or phone number is required',
  IDENTIFIER_INVALID: 'Enter a valid email address or phone number',
  PASSWORD_LENGTH: `Use at least ${PASSWORD_MIN} characters`,
  PASSWORD_MATCH: 'Passwords do not match',
  TERMS_REQUIRED: 'Please accept the Terms of Service and Privacy Policy',
}

// Client-side mirror of the server's parseIdentifier heuristic
// (server/utils/identifier): an `@` means email, otherwise 7–15 digits means
// phone. The server re-validates and is the authority.
function looksLikeIdentifier(value: string): boolean {
  const v = value.trim()
  if (v.includes('@')) {
    return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(v)
  }
  const digits = v.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

const passwordRef = ref<InstanceType<typeof AddonInputPassword>>()
const showPassword = ref(false)
const errorMessage = ref('')

const zodSchema = z
  .object({
    name: z.string().trim().min(1, VALIDATION_TEXT.NAME_REQUIRED).max(200),
    identifier: z
      .string()
      .min(1, VALIDATION_TEXT.IDENTIFIER_REQUIRED)
      .refine(looksLikeIdentifier, VALIDATION_TEXT.IDENTIFIER_INVALID),
    password: z.string().min(PASSWORD_MIN, VALIDATION_TEXT.PASSWORD_LENGTH),
    confirmPassword: z.string(),
    terms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // zxcvbn feedback from AddonInputPassword, surfaced as a form error.
    if (passwordRef.value?.validation?.feedback?.warning || passwordRef.value?.validation?.feedback?.suggestions?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: passwordRef.value?.validation?.feedback?.warning || passwordRef.value.validation.feedback?.suggestions?.[0],
        path: ['password'],
      })
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: VALIDATION_TEXT.PASSWORD_MATCH, path: ['confirmPassword'] })
    }
    if (!data.terms) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: VALIDATION_TEXT.TERMS_REQUIRED, path: ['terms'] })
    }
  })

type FormInput = z.infer<typeof zodSchema>

const validationSchema = toTypedSchema(zodSchema)
const initialValues = {
  name: '',
  identifier: '',
  password: '',
  confirmPassword: '',
  terms: false,
} satisfies FormInput

const { values, handleSubmit, isSubmitting } = useForm({ validationSchema, initialValues })

const { fetchUser } = useUser()
const router = useRouter()

const onSubmit = handleSubmit(async (formValues) => {
  errorMessage.value = ''
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        // `name` is split into firstName / lastName server-side.
        name: formValues.name.trim(),
        identifier: formValues.identifier,
        password: formValues.password,
      },
    })
    // Signup sets the session cookie, so the new customer is already in.
    await fetchUser({ force: true })
    await router.push('/dashboards/balance')
  }
  catch (error: any) {
    // Beside the form, like sign-in — not a toast that outlives the page.
    errorMessage.value = error?.data?.message || 'We couldn\'t create your account. Please try again.'
  }
})
</script>

<template>
  <div class="apex-fade">
    <h1 class="font-heading text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-muted-900 dark:text-white">
      Create your account
    </h1>
    <p class="text-muted-400 mt-2.5 text-[14.5px]">
      Takes a minute. No card needed.
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
      <!-- First, because it is the easiest field to answer. -->
      <Field v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="name">
        <BaseField
          v-slot="{ inputAttrs, inputRef }"
          label="Full name"
          :state="fieldError ? 'error' : 'idle'"
          :error="fieldError"
          :disabled="isSubmitting"
        >
          <BaseInput
            :ref="inputRef"
            v-bind="inputAttrs"
            :model-value="field.value"
            autocomplete="name"
            placeholder="Jane Okafor"
            rounded="lg"
            class="h-[46px]! rounded-xl!"
            @update:model-value="handleChange"
            @blur="handleBlur"
          />
        </BaseField>
        <span class="text-muted-500 -mt-1 block text-[11.5px] leading-[1.45]">
          So we know what to call you — this is the name your project manager sees.
        </span>
      </Field>

      <Field v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="identifier">
        <BaseField
          v-slot="{ inputAttrs, inputRef }"
          label="Email or phone number"
          :state="fieldError ? 'error' : 'idle'"
          :error="fieldError"
          :disabled="isSubmitting"
        >
          <BaseInput
            :ref="inputRef"
            v-bind="inputAttrs"
            :model-value="field.value"
            autocomplete="username"
            placeholder="you@company.co.uk or 07911 123456"
            rounded="lg"
            class="h-[46px]! rounded-xl!"
            @update:model-value="handleChange"
            @blur="handleBlur"
          />
        </BaseField>
      </Field>

      <Field v-slot="{ field, errorMessage: fieldError, handleChange, handleBlur }" name="password">
        <div class="relative">
          <BaseField
            v-slot="{ inputAttrs, inputRef }"
            label="Password"
            :state="fieldError ? 'error' : 'idle'"
            :error="fieldError"
            :disabled="isSubmitting"
          >
            <AddonInputPassword
              :ref="(el: any) => { inputRef(el); passwordRef = el }"
              v-bind="inputAttrs"
              :model-value="field.value"
              :type="showPassword ? 'text' : 'password'"
              :user-inputs="[values.identifier ?? '', values.name ?? '']"
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
            placeholder="Re-enter it"
            rounded="lg"
            class="h-[46px]! rounded-xl!"
            @update:model-value="handleChange"
            @blur="handleBlur"
          />
        </BaseField>
      </Field>

      <!--
        The checkbox and the sentence are SIBLINGS, never parent and child.
        Tairo's BaseCheckbox slots its label inside the control, so a click on
        "Terms of Service" bubbled to the checkbox handler: the customer
        silently consented (or withdrew consent) and never reached the
        document. Interactive content inside a control is also invalid HTML.
      -->
      <Field v-slot="{ field, errorMessage: fieldError, handleChange }" name="terms">
        <div>
          <div class="flex items-start gap-3">
            <BaseCheckbox
              :model-value="field.value"
              :disabled="isSubmitting"
              aria-labelledby="signup-terms-label"
              variant="default"
              class="mt-px"
              @update:model-value="handleChange"
            />
            <span id="signup-terms-label" class="text-muted-400 flex-1 text-[13px] leading-[1.5]">
              I agree to the
              <NuxtLink to="/legal/terms" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">Terms of Service</NuxtLink>
              and
              <NuxtLink to="/legal/privacy" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">Privacy Policy</NuxtLink>.
            </span>
          </div>
          <span v-if="fieldError" class="mt-1.5 block text-[12px] text-[#EC6453]">{{ fieldError }}</span>
        </div>
      </Field>

      <BaseButton
        type="submit"
        variant="primary"
        rounded="full"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        class="mt-2 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
      >
        Create account
      </BaseButton>
    </form>

    <p class="text-muted-400 mt-[22px] text-center text-[13.5px]">
      Already have an account?
      <NuxtLink to="/auth/login-1" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
        Sign in
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
