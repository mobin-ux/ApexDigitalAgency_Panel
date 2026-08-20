<script setup lang="ts">
/**
 * TODO(legal): replace the body of this page with Apex's actual Terms of
 * Service before launch.
 *
 * Signup asks the customer to tick "I agree to the Terms of Service", and
 * before Phase 8 that link was `href="#"` — they could not read what they
 * were agreeing to, which makes the click-wrap unenforceable. This route
 * exists so the link resolves and so the gap is visible rather than hidden,
 * but a consent page that does not contain the terms is still not a valid
 * click-wrap: the document itself has to be published here.
 *
 * Nothing on this page is invented. It states where the binding terms
 * currently live (the project agreement each customer signs — see
 * `server/utils/agreement.ts`) and how to obtain them.
 */
definePageMeta({
  layout: 'auth',
  title: 'Terms of Service',
})

const { data: config } = await useFetch<any>('/api/config', { lazy: true })
const supportEmail = computed(() => (config.value as any)?.supportEmail ?? 'support@apexdigi.co.uk')
</script>

<template>
  <article class="flex flex-col gap-5">
    <div>
      <h1 class="font-heading text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-muted-900 dark:text-white">
        Terms of Service
      </h1>
      <p class="text-muted-400 mt-2.5 text-[14.5px] leading-[1.6]">
        Apex Digital Agency, United Kingdom.
      </p>
    </div>

    <div class="rounded-2xl border border-muted-200 dark:border-white/8 bg-muted-100 dark:bg-muted-800 p-6">
      <p class="text-muted-400 text-sm leading-[1.7]">
        The terms that bind a piece of work are set out in the project agreement you sign
        before that project starts — it covers scope, timeline, payment schedule and
        cancellation. You can read your signed agreements at any time from
        <NuxtLink to="/dashboards/orders" class="text-primary-400 hover:text-primary-300 font-semibold">
          My orders
        </NuxtLink>.
      </p>
      <p class="text-muted-400 mt-4 text-sm leading-[1.7]">
        A consolidated Terms of Service for this portal is being prepared. Until it is
        published here, ask us for a copy and we'll send it before you commit to anything:
        <a :href="`mailto:${supportEmail}`" class="text-primary-400 hover:text-primary-300 font-semibold">{{ supportEmail }}</a>,
        or open a request from
        <NuxtLink to="/dashboards/support" class="text-primary-400 hover:text-primary-300 font-semibold">
          Support
        </NuxtLink>.
      </p>
    </div>

    <p class="text-[13.5px]">
      <NuxtLink to="/auth/signup-2" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
        Back to create account
      </NuxtLink>
    </p>
  </article>
</template>
