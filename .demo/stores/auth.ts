import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as null | { email: string; name: string },
    loading: false,
  }),
  
  getters: {
    isLoggedIn: (state) => !!state.user,
  },

  actions: {
    // ۱. تابع گرفتن اطلاعات کاربر (مثلاً وقتی صفحه رفرش می‌شود)
    async fetchUser() {
      this.loading = true
      try {
        const { data, error } = await useFetch('/api/auth/me')
        if (data.value && data.value.user) {
          this.user = data.value.user
        } else {
          this.user = null
        }
      } catch (e) {
        this.user = null
      } finally {
        this.loading = false
      }
    },

    // ۲. تابع لاگین
    async login(credentials: { email: string; password: string }) {
      const { data, error } = await useFetch('/api/auth/login', {
        method: 'POST',
        body: credentials
      })

      if (error.value) {
        throw error.value
      }

      // بعد از لاگین موفق، اطلاعات کاربر را آپدیت کن
      if (data.value && data.value.user) {
        this.user = data.value.user
      }
    },

    // ۳. تابع خروج
    async logout() {
      await useFetch('/api/auth/logout', { method: 'POST' })
      this.user = null
      navigateTo('/login') // هدایت به صفحه لاگین
    }
  }
})
