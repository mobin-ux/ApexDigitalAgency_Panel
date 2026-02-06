<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'
import { z } from 'zod'

definePageMeta({
  layout: 'empty',
  title: 'Login',
  preview: {
    title: 'Login 1',
    description: 'Login with simple fields',
    categories: ['layouts', 'authentication'],
    src: '/img/screens/auth-login-1.png',
    srcDark: '/img/screens/auth-login-1-dark.png',
    order: 150,
  },
})

// --- 1. Validation Schema ---
const VALIDATION_TEXT = {
  EMAIL_REQUIRED: 'A valid email is required',
  PASSWORD_REQUIRED: 'Password is required',
}

const zodSchema = z.object({
  email: z.string().email(VALIDATION_TEXT.EMAIL_REQUIRED),
  password: z.string().min(1, VALIDATION_TEXT.PASSWORD_REQUIRED),
})

type FormInput = z.infer<typeof zodSchema>

const validationSchema = toTypedSchema(zodSchema)
const initialValues = {
  email: '',
  password: '',
} satisfies FormInput

// --- 2. Form Setup ---
const { handleSubmit, isSubmitting } = useForm({
  validationSchema,
  initialValues,
})

const router = useRouter()
const { fetchUser } = useUser() // Use our custom composable
const errorMessage = ref('')

// --- 3. Login Logic ---
const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''
  
  try {
    // A. Send request to Backend API
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: values.email,
        password: values.password
      }
    })

    // B. Refresh User State (Get user data into session)
    await fetchUser()

    // C. Redirect to Dashboard
    router.push('/')

  } catch (error: any) {
    // Handle Errors (Wrong password, etc.)
    console.error('Login Error:', error)
    errorMessage.value = error.statusMessage || error.data?.message || 'Invalid email or password.'
  }
})
</script>

<template>
  <div v-if="errorMessage" class="mb-4 rounded bg-red-100 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
  {{ errorMessage }}
</div>
  <div class="dark:bg-muted-800 flex min-h-screen bg-white">
    <div
      class="bg-muted-100 dark:bg-muted-900 relative hidden w-0 flex-1 items-center justify-center lg:flex lg:w-3/5"
    >
      <div
        class="mx-auto flex size-full max-w-4xl items-center justify-center"
      >
        <!-- Media image -->
        <img
          class="mx-auto max-w-xl"
          src="/img/illustrations/station.svg"
          alt=""
          width="619"
          height="594"
        >
      </div>
    </div>
    <div
      class="relative flex flex-1 flex-col justify-center px-6 py-12 lg:w-2/5 lg:flex-none"
    >
      <div class="dark:bg-muted-800 relative mx-auto w-full max-w-sm bg-white">
        <!-- Nav -->
        <div class="flex w-full items-center justify-between">
          <NuxtLink
            to="/dashboards"
            class="text-muted-400 hover:text-primary-500 flex items-center gap-2 font-sans font-medium transition-colors duration-300"
          >
            <Icon name="gg:arrow-long-left" class="size-5" />
            <span>Back to Home</span>
          </NuxtLink>
          <!-- Theme button -->
          <BaseThemeToggle />
        </div>
        <div>
          <BaseHeading
            as="h2"
            size="3xl"
            lead="relaxed"
            weight="medium"
            class="mt-6"
          >
            Welcome back.
          </BaseHeading>
          <BaseParagraph size="sm" class="text-muted-400 mb-6">
            Login with social media or your credentials
          </BaseParagraph>
          <!-- Social Sign Up Buttons -->
          <div class="flex flex-wrap justify-between gap-4">
            <!-- Google button -->
            <button
              class="dark:bg-muted-700 text-muted-800 border-muted-300 dark:border-muted-600 focus-visible:nui-focus relative inline-flex grow items-center justify-center gap-2 rounded-xl border bg-white px-6 py-4 dark:text-white"
            >
              <Icon name="logos:google-icon" class="size-5" />
              <div>Login with Google</div>
            </button>
            <!-- Twitter button -->
            <button
              class="bg-muted-200 dark:bg-muted-700 hover:bg-muted-100 dark:hover:bg-muted-600 text-muted-600 dark:text-muted-400 focus-visible:nui-focus w-[calc(50%_-_0.5rem)] cursor-pointer rounded-xl px-5 py-4 text-center transition-colors duration-300 md:w-auto"
            >
              <Icon name="fa6-brands:x-twitter" class="mx-auto size-4" />
            </button>
            <!-- Linkedin button -->
            <button
              class="bg-muted-200 dark:bg-muted-700 hover:bg-muted-100 dark:hover:bg-muted-600 text-muted-600 dark:text-muted-400 focus-visible:nui-focus w-[calc(50%_-_0.5rem)] cursor-pointer rounded-xl px-5 py-4 text-center transition-colors duration-300 md:w-auto"
            >
              <Icon name="fa6-brands:linkedin-in" class="mx-auto size-4" />
            </button>
          </div>
          <!-- 'or' divider -->
          <div class="flex-100 mt-8 flex items-center">
            <hr
              class="border-muted-200 dark:border-muted-700 flex-auto border-t-2"
            >
            <span class="text-muted-400 px-4 font-sans font-light"> OR </span>
            <hr
              class="border-muted-200 dark:border-muted-700 flex-auto border-t-2"
            >
          </div>
        </div>

        <!-- Form section -->
        <div class="mt-6">
          <div class="mt-5">
            <!-- Form -->
            <form
              method="POST"
              action=""
              class="mt-6"
              novalidate
              @submit.prevent="onSubmit"
            >
              <div class="space-y-4">
                <Field
                  v-slot="{ field, errorMessage, handleChange, handleBlur }"
                  name="email"
                >
                  <BaseField
                    v-slot="{ inputAttrs, inputRef }"
                    label="Email address"
                    :state="errorMessage ? 'error' : 'idle'"
                    :error="errorMessage"
                    :disabled="isSubmitting"
                    required
                  >
                    <BaseInput
                      :ref="inputRef"
                      v-bind="inputAttrs"
                      :model-value="field.value"
                      autocomplete="email"
                      rounded="lg"
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
                    v-slot="{ inputAttrs, inputRef }"
                    label="Password"
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
                      autocomplete="current-password"
                      rounded="lg"
                      @update:model-value="handleChange"
                      @blur="handleBlur"
                    />
                  </BaseField>
                </Field>
              </div>

              <!-- Remember -->
              <div class="mt-6 flex items-center justify-between">
                <Field
                  v-slot="{ field, handleChange, handleBlur }"
                  name="trustDevice"
                >
                  <BaseCheckbox
                    :model-value="field.value"
                    :disabled="isSubmitting"
                    label="Trust for 60 days"
                    variant="default"
                    @update:model-value="handleChange"
                    @blur="handleBlur"
                  />
                </Field>

                <div class="text-xs leading-5">
                  <NuxtLink
                    to="/auth/recover"
                    class="text-primary-600 hover:text-primary-500 font-sans font-medium underline-offset-4 transition duration-150 ease-in-out hover:underline"
                  >
                    Forgot your password?
                  </NuxtLink>
                </div>
              </div>

              <!-- Submit -->
              <div class="mt-6">
                <div class="block w-full rounded-md shadow-xs">
                  <BaseButton
                    :disabled="isSubmitting"
                    :loading="isSubmitting"
                    type="submit"
                    variant="primary"
                    rounded="lg"
                    class="h-11! w-full"
                  >
                    Sign in
                  </BaseButton>
                </div>
              </div>
            </form>

            <!-- No account link -->
            <p
              class="text-muted-400 mt-4 flex justify-between font-sans text-xs leading-5"
            >
              <span>Don't have an account?</span>
              <NuxtLink
                to="/auth/signup-2"
                class="text-primary-600 hover:text-primary-500 font-medium underline-offset-4 transition duration-150 ease-in-out hover:underline"
              >
                start your 14-day free trial
              </NuxtLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
