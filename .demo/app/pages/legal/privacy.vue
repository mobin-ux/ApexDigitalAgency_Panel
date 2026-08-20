<script setup lang="ts">
/**
 * TODO(legal): replace the body of this page with Apex's actual Privacy
 * Policy before launch. A UK product that processes personal data and takes
 * payments is required to publish one, and signup links here as part of the
 * consent the customer gives.
 *
 * The list below is not a policy — it is a factual description of what this
 * application stores, read off `prisma/schema.prisma`, so it cannot drift
 * into claims the code does not support. A real policy also needs the legal
 * basis for each purpose, retention periods, the controller's identity and
 * the customer's rights under UK GDPR.
 */
definePageMeta({
  layout: 'auth',
  title: 'Privacy Policy',
})

const { data: config } = await useFetch<any>('/api/config', { lazy: true })
const supportEmail = computed(() => (config.value as any)?.supportEmail ?? 'support@apexdigi.co.uk')

/** Each entry maps to columns that exist today. */
const STORED = [
  { what: 'Your name, email address and phone number', why: 'To identify your account, sign you in and contact you about your projects.' },
  { what: 'Your company details', why: 'To put the right party on contracts and receipts.' },
  { what: 'Projects, milestones and files', why: 'To deliver and track the work you commission.' },
  { what: 'Payments, installment plans and ledger entries', why: 'To take payment, keep accurate financial records and meet UK accounting obligations.' },
  { what: 'Support tickets and messages', why: 'To answer you and keep a history of what was agreed.' },
]
</script>

<template>
  <article class="flex flex-col gap-5">
    <div>
      <h1 class="font-heading text-3xl font-extrabold leading-[1.1] tracking-[-0.02em] text-muted-900 dark:text-white">
        Privacy Policy
      </h1>
      <p class="text-muted-400 mt-2.5 text-[14.5px] leading-[1.6]">
        Apex Digital Agency, United Kingdom.
      </p>
    </div>

    <div class="rounded-2xl border border-muted-200 dark:border-white/8 bg-muted-100 dark:bg-muted-800 p-6">
      <h2 class="text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted-500">
        What this account holds
      </h2>
      <dl class="mt-4 flex flex-col gap-4">
        <div v-for="row in STORED" :key="row.what">
          <dt class="text-[13.5px] font-semibold text-muted-900 dark:text-white">
            {{ row.what }}
          </dt>
          <dd class="text-muted-400 mt-1 text-[13px] leading-[1.6]">
            {{ row.why }}
          </dd>
        </div>
      </dl>
      <p class="text-muted-400 mt-5 border-t border-muted-200 dark:border-white/8 pt-5 text-[13px] leading-[1.7]">
        Card details are never stored on our servers — card entry happens on the payment
        provider's own page, and we keep only the card brand, last four digits and expiry
        so you can recognise it.
      </p>
    </div>

    <div class="rounded-2xl border border-muted-200 dark:border-white/8 bg-muted-100 dark:bg-muted-800 p-6">
      <p class="text-muted-400 text-sm leading-[1.7]">
        The full policy — including the legal basis for each use, how long we keep records
        and how to exercise your rights under UK GDPR — is being prepared and will be
        published here. To ask what we hold about you, to correct it, or to request
        deletion, email
        <a :href="`mailto:${supportEmail}`" class="text-primary-400 hover:text-primary-300 font-semibold">{{ supportEmail }}</a>.
      </p>
    </div>

    <p class="text-[13.5px]">
      <NuxtLink to="/auth/signup-2" class="apex-focus text-primary-400 hover:text-primary-300 rounded font-semibold">
        Back to create account
      </NuxtLink>
    </p>
  </article>
</template>
