<script setup lang="ts">
/**
 * Sign in — Apex Design V2, Phase 8.
 *
 * The flow and the endpoint are unchanged: POST /api/auth/login with an
 * identifier that is either an email address or a mobile number, the server
 * decides which. The neutral failure copy is deliberate and stays — telling
 * the visitor whether the account exists is an enumeration oracle.
 *
 * What changed: the shell moved to `layouts/auth.vue`, the error alert moved
 * into the form column (it used to be a sibling of the full-screen layout,
 * above it, so a failed sign-in pushed the whole page down), the duplicate
 * toast is gone, and the three social buttons went with it — they had no
 * click handler, no OAuth provider and no `/api/auth/oauth/*` route, while
 * being the largest controls on the page.
 */
import { toTypedSchema } from '@vee-validate/zod'
import { Field, useForm } from 'vee-validate'
import { z } from 'zod'

definePageMeta({
  layout: 'auth',
  title: 'Sign in',
  /**
   * A signed-in visitor used to land back on the sign-in form. `middleware: []`
   * meant no guard ran at all; this sends them where they were going.
   */
  middleware: [
    async () => {
      const { user, fetchUser } = useUser()
      if (!user.value) {
        // Cheap on the client (the boot plugin has usually filled it in);
        // on a hard load this is the one request that decides.
        await fetchUser().catch(() => {})
      }
      if (user.value) {
        return navigateTo('/dashboards/balance')
      }
    },
  ],
})

const { fetchUser } = useUser()
const router = useRouter()

const errorMessage = ref('')
const showPassword = ref(false)
const formRef = ref<HTMLFormElement | null>(null)

const validationSchema = toTypedSchema(
  z.object({
    // The identifier is an email OR a mobile number, so only a non-empty
    // value is required here; the server re-validates and decides.
    identifier: z.string().min(1, 'Enter your email address or phone number'),
    password: z.string().min(1, 'Enter your password'),
  }),
)

const { handleSubmit, isSubmitting } = useForm({ validationSchema })

const onSubmit = handleSubmit(
  async (values) => {
    errorMessage.value = ''
    try {
      await $fetch('/api/auth/login', {
        method: 'POST',
        body: { identifier: values.identifier, password: values.password },
      })
      await fetchUser({ force: true })
      await router.push('/dashboards/balance')
    }
    catch (error: any) {
      /*
       * 429 carries a real, specific message from the rate limiter
       * ("Too many attempts. Try again in N seconds."), and a visitor who is
       * locked out needs to be told that rather than "check your details" —
       * which sends them round the loop that triggered the limit.
       */
      errorMessage.value = error?.statusCode === 429
        ? (error?.data?.message || 'Too many attempts. Please wait a minute and try again.')
        : (error?.data?.message || 'We couldn\'t sign you in. Check your details and try again.')
    }
  },
  // Invalid form: the fields show their own errors, so the banner would just
  // repeat them.
  () => {
    errorMessage.value = ''
  },
)

onMounted(() => {
  /*
   * Straight to the first field — none of the three auth pages focused
   * anything. Queried from the form rather than through a component ref:
   * `BaseField` already owns `inputRef` on `BaseInput`, and stacking a second
   * ref on it resolved to a wrapper with no input to focus.
   */
  formRef.value?.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.focus()
})
</script>

<template>
  <div class="apex-fade">
    <h1 class="font-heading text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-muted-900 dark:text-white">
      Welcome back
    </h1>
    <p class="text-muted-400 mt-2.5 text-[14.5px]">
      Sign in to your Apex account.
    </p>

    <!--
      Inside the form column and above the fields it refers to. This used to
      be the template's first root node, a sibling of the entire page, so the
      layout shifted down by the banner's height on every failure.
    -->
    <div
      v-if="errorMessage"
      role="alert"
      class="mt-5 flex items-start gap-2.5 rounded-xl border border-[#EC6453]/32 bg-[#EC6453]/10 px-[15px] py-[13px]"
    >
      <Icon name="lucide:alert-triangle" class="mt-px size-[17px] shrink-0 text-[#EC6453]" />
      <span class="flex-1 text-[13px] leading-[1.5] text-muted-900 dark:text-white">{{ errorMessage }}</span>
    </div>

    <form ref="formRef" novalidate class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
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
        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <span class="text-[12.5px] font-semibold text-muted-900 dark:text-white">Password</span>
            <NuxtLink
              to="/auth/recover"
              class="apex-focus text-primary-400 hover:text-primary-300 rounded text-[12.5px] font-semibold"
            >
              Forgot password?
            </NuxtLink>
          </div>
          <div class="relative">
            <BaseField
              v-slot="{ inputAttrs, inputRef }"
              :state="fieldError ? 'error' : 'idle'"
              :error="fieldError"
              :disabled="isSubmitting"
            >
              <BaseInput
                :ref="inputRef"
                v-bind="inputAttrs"
                :model-value="field.value"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                rounded="lg"
                class="h-[46px]! rounded-xl! pe-12!"
                @update:model-value="handleChange"
                @blur="handleBlur"
              />
            </BaseField>
            <!-- A 10-character minimum without a reveal control just produces
                 typos. `aria-pressed` because it toggles a state. -->
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
      </Field>

      <BaseButton
        type="submit"
        variant="primary"
        rounded="full"
        :disabled="isSubmitting"
        :loading="isSubmitting"
        class="mt-2 h-12! w-full shadow-[0_10px_24px_rgba(125,83,242,0.32)]"
      >
        Sign in
      </BaseButton>
    </form>

    <p class="text-muted-400 mt-[22px] text-center text-[13.5px]">
      New to Apex?
      <NuxtLink to="/auth/signup-2" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
        Create an account
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
