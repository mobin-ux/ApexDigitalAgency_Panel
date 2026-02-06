<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'
import { z } from 'zod'

definePageMeta({
  layout: 'empty',
  title: 'Recover Password',
  preview: {
    title: 'Recover',
    description: 'For password recovery',
    categories: ['layouts', 'authentication'],
    src: '/img/screens/auth-recover.png',
    srcDark: '/img/screens/auth-recover-dark.png',
    order: 156,
  },
})

const route = useRoute()
const router = useRouter()

// Computed property to check if token exists
const token = computed(() => route.query.token as string)
const isResetMode = computed(() => !!token.value)

// --- VALIDATION SCHEMAS ---

// 1. Schema for Requesting Link (Email only)
const requestSchema = toTypedSchema(
  z.object({
    email: z.string().email('A valid email is required'),
  })
)

// 2. Schema for Setting New Password
const resetSchema = toTypedSchema(
  z.object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })
)

// Dynamic Schema based on mode
const validationSchema = computed(() => isResetMode.value ? resetSchema : requestSchema)

const { handleSubmit, isSubmitting } = useForm({
  validationSchema,
})

// UI States
const success = ref(false)
const errorMessage = ref('')

// --- FORM HANDLER ---

const onSubmit = handleSubmit(async (values) => {
  errorMessage.value = ''
  
  try {
    if (isResetMode.value) {
      // PHASE 2: Set New Password
      await $fetch('/api/auth/reset-password-confirm', {
        method: 'POST',
        body: {
          token: token.value,
          newPassword: values.password
        }
      })
      
      // Success Alert & Redirect
      // We use a small delay or direct push
      router.push('/auth/login-1')

    } else {
      // PHASE 1: Request Link
      await $fetch('/api/auth/reset-password-request', {
        method: 'POST',
        body: { email: values.email }
      })
      success.value = true
    }

  } catch (error: any) {
    console.error('Operation Error:', error)
    errorMessage.value = error.statusMessage || error.data?.message || 'An error occurred.'
  }
})
</script>

<template>
  <div class="bg-muted-100 dark:bg-muted-900 relative min-h-screen w-full overflow-hidden px-4 dark:[--color-input-default-bg:var(--color-muted-950)]">
    <div class="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
      <NuxtLink to="/" class="text-muted-400 hover:text-primary-500 transition-colors duration-300">
        <TairoLogo class="size-10" />
      </NuxtLink>
      <div><BaseThemeToggle /></div>
    </div>

    <div class="flex w-full items-center justify-center">
      <div class="relative mx-auto w-full max-w-md mt-4">
        
        <ClientOnly>
          
          <template #fallback>
            <div class="flex justify-center p-8">
              <div class="animate-pulse text-muted-400">Loading...</div>
            </div>
          </template>

          <div class="text-center">
            <BaseHeading as="h2" size="3xl" weight="medium">
              {{ isResetMode ? 'Set New Password' : 'Recover Password' }}
            </BaseHeading>
            <BaseParagraph size="sm" class="text-muted-400 mb-6">
              {{ isResetMode ? 'Enter your new secure password below' : 'Follow the instructions sent to your email address' }}
            </BaseParagraph>
          </div>
            
          <Transition mode="out-in" enter-active-class="transition-all duration-300 ease-out" leave-active-class="transition-all duration-75 ease-in">
            
            <div v-if="success && !isResetMode" class="px-8 py-4">
              <BaseMessage class="p-6" :closable="false">
                <p class="text-base">Link sent! Check your console/email.</p>
              </BaseMessage>
              <div class="mt-4 text-center">
                 <NuxtLink to="/auth/login-1" class="text-primary-500 underline">Back to Login</NuxtLink>
              </div>
            </div>

            <form v-else class="px-8 py-4" @submit.prevent="onSubmit">
              
              <div v-if="errorMessage" class="mb-4 rounded bg-red-100 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {{ errorMessage }}
              </div>

              <div class="mb-4 space-y-4">
                
                <Field v-if="!isResetMode" v-slot="{ field, errorMessage, handleChange, handleBlur }" name="email">
                  <BaseField label="Email address" :state="errorMessage ? 'error' : 'idle'" :error="errorMessage">
                    <BaseInput :model-value="field.value" @update:model-value="handleChange" @blur="handleBlur" placeholder="Enter email" />
                  </BaseField>
                </Field>

                <div v-else class="space-y-4">
                  <Field v-slot="{ field, errorMessage, handleChange, handleBlur }" name="password">
                    <BaseField label="New Password" :state="errorMessage ? 'error' : 'idle'" :error="errorMessage">
                      <BaseInput type="password" :model-value="field.value" @update:model-value="handleChange" @blur="handleBlur" placeholder="Min 8 chars" />
                    </BaseField>
                  </Field>

                  <Field v-slot="{ field, errorMessage, handleChange, handleBlur }" name="confirmPassword">
                    <BaseField label="Confirm Password" :state="errorMessage ? 'error' : 'idle'" :error="errorMessage">
                      <BaseInput type="password" :model-value="field.value" @update:model-value="handleChange" @blur="handleBlur" placeholder="Repeat password" />
                    </BaseField>
                  </Field>
                </div>

              </div>

              <div class="mb-6">
                <BaseButton :loading="isSubmitting" type="submit" variant="primary" class="h-12! w-full">
                  {{ isResetMode ? 'Update Password' : 'Send Recovery Link' }}
                </BaseButton>
              </div>

              <p class="text-muted-400 mt-4 text-center text-sm">
                <NuxtLink to="/auth/login-1" class="text-primary-600 hover:underline">Back to Login</NuxtLink>
              </p>
            </form>

          </Transition>

        </ClientOnly>

      </div>
    </div>
  </div>
</template>