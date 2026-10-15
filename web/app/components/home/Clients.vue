<script setup lang="ts">
import { clients } from '~/data/home'
</script>

<template>
  <section
    aria-label="Clients"
    class="border-y border-line bg-page"
  >
    <div class="container-page flex flex-col gap-6 py-7.5 lg:flex-row lg:items-center lg:gap-11">
      <p class="max-w-[14ch] flex-none text-[0.78rem] leading-normal font-semibold tracking-wider text-muted uppercase">
        Trusted by UK businesses
      </p>
      <ul class="grid flex-1 grid-cols-2 gap-x-7 gap-y-4 opacity-65 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between">
        <li
          v-for="client in clients"
          :key="client"
          class="font-display text-[1.4375rem] font-semibold tracking-tight text-heading"
        >
          {{ client }}
        </li>
      </ul>
    </div>
  </section>
</template>
