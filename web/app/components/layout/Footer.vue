<script setup lang="ts">
import { homeAnchors, routes } from '~/data/routes'
import { services } from '~/data/services'
import { company } from '~/data/site'

const panel = usePanelLinks()
const year = useRuntimeConfig().public.buildYear

const phoneHref = company.phone ? `tel:${company.phone.replace(/\s+/g, '')}` : ''
const social = company.social.filter(profile => profile.url)

const groups = [
  {
    label: 'Company',
    links: [
      { text: 'About Apex', to: routes.about },
      { text: 'Our work', to: routes.ourWork },
      { text: 'Pay monthly', to: `${routes.home}${homeAnchors.monthly}` },
      { text: 'Careers', to: routes.careers },
      { text: 'Contact us', to: routes.contact },
    ],
  },
  {
    label: 'Resources',
    links: [
      { text: 'Insights blog', to: routes.insights },
      { text: 'Frequently asked questions', to: `${routes.home}${homeAnchors.faq}` },
      { text: 'Website cost guide', to: routes.article('website-cost-uk-2026') },
      { text: 'Instalment plan terms', to: routes.legal.instalmentTerms },
      { text: 'Client dashboard', href: panel.dashboard },
    ],
  },
  {
    label: 'Legal',
    links: [
      { text: 'Privacy notice', to: routes.legal.privacy },
      { text: 'Cookie policy', to: routes.legal.cookies },
      { text: 'Terms of service', to: routes.legal.terms },
      { text: 'Accessibility statement', to: routes.legal.accessibility },
      { text: 'Complaints procedure', to: routes.legal.complaints },
    ],
  },
] as const

const linkClass = 'text-[0.9063rem] text-body transition-colors hover:text-violet-600'
</script>

<template>
  <footer class="border-t border-line bg-subtle">
    <div class="container-page">
      <div class="flex flex-col gap-6 border-b border-line-strong py-8 md:flex-row md:items-center md:gap-10">
        <div class="flex flex-col gap-1">
          <p class="font-display text-[1.1875rem] font-semibold tracking-tight text-heading">
            Prefer to talk it through first?
          </p>
          <p class="text-[0.9063rem] text-body">
            Fifteen minutes, no pitch deck. We reply within one working day.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-x-7 gap-y-4 md:ml-auto">
          <a
            v-if="phoneHref"
            :href="phoneHref"
            class="font-display text-[1.0625rem] font-semibold text-heading"
          >{{ company.phone }}</a>
          <a
            :href="`mailto:${company.email}`"
            class="text-[0.9375rem] font-semibold text-body transition-colors hover:text-violet-600"
          >{{ company.email }}</a>
          <UiButton
            :to="routes.contact"
            size="sm"
          >
            Book a free call
          </UiButton>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-6 gap-y-10 py-14 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr] lg:gap-11">
        <div class="col-span-2 flex flex-col gap-5.5 lg:col-span-1">
          <NuxtLink
            :to="routes.home"
            class="block w-fit"
          >
            <img
              src="/brand/apex-wordmark.svg"
              alt="Apex Digital Agency"
              width="96"
              height="26"
              class="block h-6.5 w-auto"
              loading="lazy"
            >
          </NuxtLink>
          <p class="max-w-[30ch] text-[0.9063rem] leading-relaxed text-body">
            {{ company.tagline }}
          </p>
          <address class="flex flex-col gap-1.5 text-sm text-body not-italic">
            <span>{{ company.legalName }}</span>
            <span>{{ company.address.locality }}, {{ company.address.region }}, England</span>
          </address>
          <ul
            v-if="social.length"
            class="flex gap-2"
          >
            <li
              v-for="profile in social"
              :key="profile.label"
            >
              <a
                :href="profile.url"
                :aria-label="profile.label"
                rel="me noopener"
                class="inline-flex size-10 items-center justify-center rounded-md border border-line-strong bg-white font-display text-xs font-semibold text-body transition-colors hover:border-violet-500 hover:text-violet-500"
              >{{ profile.short }}</a>
            </li>
          </ul>
        </div>

        <nav aria-label="Services">
          <p class="mb-4 text-[0.6875rem] font-bold tracking-widest text-muted uppercase">
            Services
          </p>
          <ul class="flex flex-col gap-3.25">
            <li
              v-for="service in services"
              :key="service.slug"
            >
              <NuxtLink
                :to="routes.service(service.slug)"
                :class="linkClass"
              >
                {{ service.shortName }}
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <nav
          v-for="group in groups"
          :key="group.label"
          :aria-label="group.label"
        >
          <p class="mb-4 text-[0.6875rem] font-bold tracking-widest text-muted uppercase">
            {{ group.label }}
          </p>
          <ul class="flex flex-col gap-3.25">
            <li
              v-for="link in group.links"
              :key="link.text"
            >
              <a
                v-if="'href' in link"
                :href="link.href"
                :class="linkClass"
              >{{ link.text }}</a>
              <NuxtLink
                v-else
                :to="link.to"
                :class="linkClass"
              >
                {{ link.text }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line-strong pt-6 pb-11 text-[0.8125rem] text-muted">
        <span>© {{ year }} {{ company.legalName }}</span>
        <span v-if="company.companyNumber">Company no. {{ company.companyNumber }}</span>
        <span v-if="company.vatNumber">VAT no. {{ company.vatNumber }}</span>
        <span class="md:ml-auto">Registered in {{ company.registeredIn }}</span>
      </div>
    </div>
  </footer>
</template>
