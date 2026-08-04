<script setup lang="ts">
import type { AddonInputPassword } from '#components'
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'

import { z } from 'zod'

definePageMeta({
  layout: 'empty',
  title: 'Signup',
  preview: {
    title: 'Signup 2',
    description: 'For authentication and sign up',
    categories: ['layouts', 'authentication'],
    src: '/img/screens/auth-signup-2.png',
    srcDark: '/img/screens/auth-signup-2-dark.png',
    order: 158,
  },
})

const VALIDATION_TEXT = {
  IDENTIFIER_REQUIRED: 'An email address or phone number is required',
  IDENTIFIER_INVALID: 'Enter a valid email address or phone number',
  PASSWORD_LENGTH: 'Password must be at least 8 characters',
  PASSWORD_MATCH: 'Passwords do not match',
  TERMS_REQUIRED: 'You must agree to the terms and conditions',
}

// Client-side mirror of the server's parseIdentifier heuristic (utils/identifier):
// an `@` means email, otherwise 7–15 digits means phone. The server re-validates.
function looksLikeIdentifier(value: string): boolean {
  const v = value.trim()
  if (v.includes('@')) {
    return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(v)
  }
  const digits = v.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

const passwordRef = ref<InstanceType<typeof AddonInputPassword>>()

// This is the Zod schema for the form input
// It's used to define the shape that the form data will have
const zodSchema = z
  .object({
    identifier: z
      .string()
      .min(1, VALIDATION_TEXT.IDENTIFIER_REQUIRED)
      .refine(looksLikeIdentifier, VALIDATION_TEXT.IDENTIFIER_INVALID),
    password: z.string().min(8, VALIDATION_TEXT.PASSWORD_LENGTH),
    confirmPassword: z.string(),
    terms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // This is a custom validation function that will be called
    // before the form is submitted
    if (passwordRef.value?.validation?.feedback?.warning || passwordRef.value?.validation?.feedback?.suggestions?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: passwordRef.value?.validation?.feedback?.warning || passwordRef.value.validation.feedback?.suggestions?.[0],
        path: ['password'],
      })
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: VALIDATION_TEXT.PASSWORD_MATCH,
        path: ['confirmPassword'],
      })
    }
    if (!data.terms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: VALIDATION_TEXT.TERMS_REQUIRED,
        path: ['terms'],
      })
    }
  })

// Zod has a great infer method that will
// infer the shape of the schema into a TypeScript type
type FormInput = z.infer<typeof zodSchema>

const validationSchema = toTypedSchema(zodSchema)
const initialValues = {
  identifier: '',
  password: '',
  confirmPassword: '',
  terms: false,
} satisfies FormInput

const { values, handleSubmit, isSubmitting } = useForm({
  validationSchema,
  initialValues,
})

const { fetchUser } = useUser()
const router = useRouter()
const toaster = useNuiToasts()

// Register the account, then (signup sets the session cookie) sign in and
// go straight to the dashboard.
const onSubmit = handleSubmit(async (formValues) => {
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        identifier: formValues.identifier,
        password: formValues.password,
      },
    })

    toaster.add({
      title: 'Welcome to Apex',
      description: 'Your account has been created.',
      icon: 'ph:user-circle-fill',
      progress: true,
    })

    await fetchUser({ force: true })
    await router.push('/dashboards/balance')
  }
  catch (error: any) {
    toaster.add({
      title: 'Sign up failed',
      description: error.data?.message || 'Something went wrong. Please try again.',
      icon: 'ph:warning-circle-fill',
      progress: true,
    })
  }
})
</script>

<template>
  <div
    class="bg-muted-100 dark:bg-muted-900 relative min-h-screen w-full overflow-hidden px-4 dark:[--color-input-default-bg:var(--color-muted-950)]"
  >
    <div
      class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4"
    >
      <NuxtLink
        to="/"
        class="text-muted-400 hover:text-primary-500 dark:text-muted-700 dark:hover:text-primary-500 transition-colors duration-300"
      >
        <TairoLogo class="size-10" />
      </NuxtLink>
      <div>
        <BaseThemeToggle />
      </div>
    </div>
    <div class="flex w-full items-center justify-center">
      <div class="relative mx-auto w-full max-w-2xl">
        <!-- Form -->
        <div class="me-auto ms-auto mt-4 w-full">
          <form
            method="POST"
            action=""
            class="me-auto ms-auto mt-4 w-full max-w-md"
            novalidate
            @submit.prevent="onSubmit"
          >
            <div class="text-center">
              <BaseHeading
                as="h2"
                size="3xl"
                weight="medium"
              >
                Create your account
              </BaseHeading>
              <BaseParagraph size="sm" class="text-muted-400 mb-6">
                Sign up with your email or mobile number
              </BaseParagraph>
            </div>
            <div class="px-8 py-4">
              <div class="mb-4 space-y-4">
                <Field
                  v-slot="{ field, errorMessage, handleChange, handleBlur }"
                  name="identifier"
                >
                  <BaseField
                    v-slot="{ inputAttrs, inputRef }"
                    label="Email or phone number"
                    :state="errorMessage ? 'error' : 'idle'"
                    :error="errorMessage"
                    :disabled="isSubmitting"
                    required
                  >
                    <BaseInput
                      :ref="inputRef"
                      v-bind="inputAttrs"
                      :model-value="field.value"
                      type="text"
                      placeholder="you@example.com or 07911 123456"
                      autocomplete="username"
                      @update:model-value="handleChange"
                      @blur="handleBlur"
                    />
                  </BaseField>
                </Field>

                <Field
                  v-slot="{ field, errorMessage, handleChange, handleBlur }"
                  name="password"
                >
                  <BaseField
                    v-slot="{ inputAttrs }"
                    label="Password"
                    :state="errorMessage ? 'error' : 'idle'"
                    :error="errorMessage"
                    :disabled="isSubmitting"
                    required
                  >
                    <LazyAddonInputPassword
                      ref="passwordRef"
                      v-bind="inputAttrs"
                      :model-value="field.value"
                      :error="errorMessage"
                      :user-inputs="[values.identifier ?? '']"
                      placeholder="••••••••••"
                      autocomplete="new-password"
                      class="rounded-s-none ring-0!"
                      @update:model-value="handleChange"
                      @blur="handleBlur"
                    />
                  </BaseField>
                </Field>

                <Field
                  v-slot="{ field, errorMessage, handleChange, handleBlur }"
                  name="confirmPassword"
                >
                  <BaseField
                    v-slot="{ inputAttrs, inputRef }"
                    label="Confirm Password"
                    :state="errorMessage ? 'error' : 'idle'"
                    :error="errorMessage"
                    :disabled="isSubmitting"
                    required
                  >
                    <BaseInput
                      :ref="inputRef"
                      v-bind="inputAttrs"
                      :model-value="field.value"
                      type="password"
                      placeholder="••••••••••"
                      @update:model-value="handleChange"
                      @blur="handleBlur"
                    />
                  </BaseField>
                </Field>
              </div>
              <div class="mb-6">
                <div class="mt-6 flex items-center justify-between">
                  <Field
                    v-slot="{ field, errorMessage, handleChange, handleBlur }"
                    name="terms"
                  >
                    <BaseCheckbox
                      :model-value="field.value"
                      :disabled="isSubmitting"
                      :error="errorMessage"
                      variant="default"
                      @update:model-value="handleChange"
                      @blur="handleBlur"
                    >
                      <span>
                        <span>
                          I accept the
                        </span>
                        <a
                          href="#"
                          class="text-primary-500 hover:underline focus:underline"
                        >Terms of Service</a>
                      </span>
                    </BaseCheckbox>
                  </Field>
                </div>
              </div>
              <div class="mb-6">
                <BaseButton
                  :disabled="isSubmitting"
                  :loading="isSubmitting"
                  type="submit"
                  variant="primary"
                  class="h-12! w-full"
                >
                  Sign Up
                </BaseButton>
              </div>

              <!-- Already have an account link -->
              <p
                class="text-muted-400 mt-4 flex justify-between font-sans text-sm leading-5"
              >
                <span>Already have an account?</span>
                <NuxtLink
                  to="/auth/login-1"
                  class="text-primary-600 hover:text-primary-500 font-medium underline-offset-4 transition duration-150 ease-in-out hover:underline"
                >
                  Sign in
                </NuxtLink>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
