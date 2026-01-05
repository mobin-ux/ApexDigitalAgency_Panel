<script setup lang="ts">
definePageMeta({
  title: 'Dashboard',
  // خط layout را حذف کردم چون باعث خطای "Invalid Layout" می‌شد
  preview: {
    title: 'Balance dashboard',
    description: 'For bank account overview',
    categories: ['dashboards'],
    src: '/img/screens/dashboards-balance.png',
    srcDark: '/img/screens/dashboards-balance-dark.png',
    order: 5,
    new: true,
  },
})

const showFeatures = ref(true)

// لیست کارت‌ها
const accounts = [
  {
    name: 'Chase bank',
    number: '**** **** 1728',
    balance: '$3,462.12',
    logo: '/img/logos/companies/chase-full.svg',
  },
  {
    name: 'Eurasian bank',
    number: '**** **** 3291',
    balance: '$1,763.49',
    logo: '/img/logos/companies/eurasian-full.svg',
  },
  {
    name: 'Bank of America',
    number: '**** **** 5482',
    balance: '$6,729.87',
    logo: '/img/logos/companies/bank-of-america-full.svg',
  },
]
</script>

<template>
  <div class="px-4 pb-20 md:px-6 lg:px-8">
    <div class="space-y-6">
      
      <Transition
        enter-active-class="transition origin-top duration-300 ease-out"
        enter-from-class="transform scale-y-0 opacity-0"
        enter-to-class="transform scale-y-100 opacity-100"
        leave-active-class="transition origin-top duration-200 ease-in"
        leave-from-class="transform scale-y-100 opacity-100"
        leave-to-class="transform scale-y-0 opacity-0"
      >
        <div v-if="showFeatures" class="w-full">
          <DemoWidgetFeatures>
            <template #actions>
              <BaseButton
                size="icon-sm"
                variant="muted"
                data-nui-tooltip="Hide this"
                @click="showFeatures = false"
              >
                <Icon name="lucide:x" class="size-4" />
              </BaseButton>
            </template>
          </DemoWidgetFeatures>
        </div>
      </Transition>

      <div class="grid grid-cols-12 gap-6">
        <div 
          v-for="(account, index) in accounts" 
          :key="index" 
          class="col-span-12 sm:col-span-4"
        >
          <BaseCard rounded="md" class="flex h-full flex-col justify-between p-6">
            <div class="mb-6 flex items-start justify-between">
              <div class="flex min-w-0 flex-col">
                <BaseHeading
                  weight="medium"
                  size="md"
                  class="mb-1 truncate text-muted-900 dark:text-muted-100"
                >
                  {{ account.name }}
                </BaseHeading>
                <BaseParagraph size="sm" class="text-muted-600 dark:text-muted-400">
                  {{ account.number }}
                </BaseParagraph>
              </div>
              <div class="ml-3 shrink-0">
                <img :src="account.logo" :alt="account.name" class="h-8 w-8 object-contain" />
              </div>
            </div>
            
            <div class="flex items-end justify-between">
              <div>
                <BaseHeading as="h5" size="xl" weight="bold" class="text-muted-800 dark:text-white">
                  {{ account.balance }}
                </BaseHeading>
              </div>
              <div>
                <BaseButton size="icon-sm" rounded="lg" color="default" variant="outline">
                  <Icon name="lucide:arrow-right" class="size-4" />
                </BaseButton>
              </div>
            </div>
          </BaseCard>
        </div>
      </div>

    </div>
  </div>
</template>