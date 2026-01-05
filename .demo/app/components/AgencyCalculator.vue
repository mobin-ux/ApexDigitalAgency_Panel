<script setup lang="ts">
// لیست خدمات به همراه قیمت‌های فرضی (قیمت‌ها را می‌توانید تغییر دهید)
const serviceOptions = [
  { label: 'Web Design (طراحی وب)', value: 'web_design', price: 15000000 },
  { label: 'Web Development (برنامه‌نویسی)', value: 'web_dev', price: 25000000 },
  { label: 'SEO & Marketing (سئو)', value: 'seo', price: 8000000 },
  { label: 'UI/UX Design (رابط کاربری)', value: 'ui_ux', price: 12000000 },
  { label: 'Logo Design (طراحی لوگو)', value: 'logo', price: 5000000 },
]

const contactOptions = [
  { label: 'تماس تلفنی یا پیام', value: 'call_msg' },
  { label: 'فقط پیام', value: 'msg_only' },
  { label: 'فقط ایمیل', value: 'email_only' },
]

// متغیرهای فرم
const selectedService = ref(serviceOptions[0].value) // پیش‌فرض اولی
const requestDetails = ref('')
const selectedDate = ref('')
const selectedContact = ref(contactOptions[0].value)

// محاسبه قیمت نهایی و پیدا کردن سرویس انتخاب شده
const currentService = computed(() => {
  return serviceOptions.find(s => s.value === selectedService.value) || serviceOptions[0]
})

const totalPrice = computed(() => {
  return currentService.value.price
})

// تابع فرمت کردن قیمت (سه رقم سه رقم)
const formatPrice = (price: number) => {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + ' تومان'
}

const handleSubmit = () => {
  alert('سفارش شما ثبت شد!\nخدمت: ' + currentService.value.label + '\nقیمت: ' + formatPrice(totalPrice.value))
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
    
    <div class="lg:col-span-7 space-y-6">
      <BaseCard class="p-6">
        <BaseHeading as="h3" size="lg" weight="medium" class="mb-6 border-b border-muted-200 dark:border-muted-800 pb-4">
          مشخصات پروژه
        </BaseHeading>

        <div class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-muted-700 dark:text-muted-200 mb-2">
              چه خدمتی نیاز دارید؟ (What we do)
            </label>
            <div class="relative">
              <select 
                v-model="selectedService" 
                class="w-full bg-muted-50 dark:bg-muted-900 border border-muted-300 dark:border-muted-700 text-muted-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5"
              >
                <option v-for="opt in serviceOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }} - {{ formatPrice(opt.price) }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-muted-700 dark:text-muted-200 mb-2">
              درخواست‌های ویژه (Specific requests)
            </label>
            <textarea
              v-model="requestDetails"
              rows="4"
              class="block p-2.5 w-full text-sm text-muted-900 bg-muted-50 rounded-lg border border-muted-300 focus:ring-primary-500 focus:border-primary-500 dark:bg-muted-900 dark:border-muted-700 dark:placeholder-muted-400 dark:text-white"
              placeholder="توضیحات خاصی اگر دارید بنویسید..."
            ></textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-muted-700 dark:text-muted-200 mb-2">
                تاریخ پیشنهادی
              </label>
              <input 
                type="date" 
                v-model="selectedDate"
                class="bg-muted-50 border border-muted-300 text-muted-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-muted-900 dark:border-muted-700 dark:placeholder-muted-400 dark:text-white"
              >
            </div>
            
            <div>
              <label class="block text-sm font-medium text-muted-700 dark:text-muted-200 mb-2">
                نحوه تماس با شما
              </label>
              <select 
                v-model="selectedContact"
                class="bg-muted-50 border border-muted-300 text-muted-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-muted-900 dark:border-muted-700 dark:text-white"
              >
                <option v-for="opt in contactOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <div class="lg:col-span-5">
      <div class="sticky top-24">
        <BaseCard class="p-6 bg-primary-900 text-white dark:bg-primary-950 border-none relative overflow-hidden">
          <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 rounded-full bg-white/10 blur-xl"></div>
          <div class="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 rounded-full bg-white/10 blur-xl"></div>

          <BaseHeading as="h3" size="xl" weight="bold" class="text-white mb-6">
            Summary (خلاصه)
          </BaseHeading>

          <div class="space-y-4 text-white/90">
            <div class="flex justify-between items-center border-b border-white/20 pb-3">
              <span class="text-sm font-medium">سرویس انتخاب شده:</span>
              <span class="font-bold">{{ currentService.label }}</span>
            </div>

            <div class="flex justify-between items-center border-b border-white/20 pb-3" v-if="selectedDate">
              <span class="text-sm font-medium">تاریخ:</span>
              <span>{{ selectedDate }}</span>
            </div>

            <div class="flex justify-between items-center border-b border-white/20 pb-3" v-if="requestDetails">
              <span class="text-sm font-medium">توضیحات:</span>
              <span class="text-xs truncate max-w-[150px]">{{ requestDetails }}</span>
            </div>

            <div class="pt-4 flex justify-between items-end">
              <span class="text-lg font-light">قیمت نهایی:</span>
              <span class="text-3xl font-bold text-white">{{ formatPrice(totalPrice) }}</span>
            </div>
          </div>

          <div class="mt-8">
            <button 
              @click="handleSubmit"
              class="w-full bg-white text-primary-900 hover:bg-gray-100 font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <span>ثبت سفارش</span>
              <Icon name="lucide:arrow-right" class="w-4 h-4" />
            </button>
          </div>

        </BaseCard>
        
        <BaseCard class="mt-4 p-6 text-center">
          <div class="text-sm text-muted-500">
            نیاز به مشاوره دارید؟
          </div>
          <div class="text-lg font-bold text-muted-800 dark:text-white mt-1">
            021-12345678
          </div>
        </BaseCard>
      </div>
    </div>

  </div>
</template>
