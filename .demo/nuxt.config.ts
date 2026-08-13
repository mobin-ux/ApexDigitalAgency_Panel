import process from 'node:process'

export default defineNuxtConfig({
  compatibilityDate: '2025-03-05',
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: true },

  /**
   * `viewport-fit=cover` lets the page extend into the notch / dynamic-island and
   * home-indicator regions and makes `env(safe-area-inset-*)` resolve to real
   * values — the shell gutters (main.css) and the full-height / modal calcs rely
   * on it. Without this, safe-area insets are always 0 and mobile content can
   * sit under the notch or the home indicator in standalone / PWA mode.
   */
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
    },
  },

  /**
   * Apex Digi defaults to the dark theme (brand direction), while the
   * BaseThemeToggle in the toolbar still lets customers switch to light.
   * `classSuffix: ''` keeps the toggled class as `.dark` to match main.css.
   */
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },

  extends: [
    /**
     * This extends the base Tairo layer.
     *
     * Alternatively you can use the following:
     * ["gh:cssninjaStudio/tairo/layers/tairo#v1.4.0", {
     * install: true,
     * giget: { auth: import.meta.env.GITHUB_TOKEN },
     * }]
     *
     * @see https://github.com/unjs/c12#extending-config-layer-from-remote-sources
     *
     * This would allows you to create an empty git repository
     * with only your source code and no demo.
     */
    '../layers/tairo',
  ],

  modules: [
    '@pinia/nuxt',
    'reka-ui/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@nuxt/image',
    '@nuxt/content',
    '@nuxt/fonts',
  ],
  // --- Production build tuning (VPS deploy) ---
  // @shuriken-ui/nuxt pulls in nuxt-component-meta, which prerenders metadata for
  // its ENTIRE component library at build time — minutes of CPU and >1.5GB RAM that
  // the running app never uses. Exclude every component so extraction is a no-op.
  componentMeta: {
    exclude: [/.*/],
  },
  content: {
    build: {
      markdown: {
        toc: { depth: 3, searchDepth: 2 },
        highlight: {
          theme: {
            default: 'github-light',
            dark: 'github-dark',
          },
        },
      },
    },
    renderer: {
      anchorLinks: true,
    },
  },

  experimental: {
    viewTransition: true,
    // buildCache: true,
    sharedPrerenderData: true,
    defaults: {
      nuxtLink: {
        // Here we disable the prefetch for visibility and enable it for interaction.
        // This is a good balance between performance and user experience when having a lot of links.
        prefetchOn: {
          visibility: false,
          interaction: true,
        },
      },
    },
  },
  $development: {
    experimental: {
      // Disable prefetch for development, this will make the development faster.
      defaults: {
        nuxtLink: {
          prefetch: false,
        },
      },
    },
  },

  css: [
    /**
     * Load Tailwind CSS
     */
    '~/assets/main.css',
  ],
  fonts: {
    experimental: {
      processCSSVariables: true,
    },
    // Fonts are self-hosted (Yellix .woff + Inter). Disable the remote providers so
    // @nuxt/fonts doesn't stall the build reaching Google/Bunny CDNs (10s timeouts
    // each; this box has no working IPv6 route to them).
    providers: {
      google: false,
      googleicons: false,
      bunny: false,
      adobe: false,
    },
  },

  typescript: {
    tsConfig: {
      // Here you can customize the generated tsconfig.json file
      // vueCompilerOptions: {
      //   target: 3.4,
      // },
    },
  },

  runtimeConfig: {
    /**
     * Server-only secret used to sign/verify the `auth_token` JWT.
     * Override with NUXT_JWT_SECRET in any real environment; the fallback
     * chain only exists so local dev logins keep working out of the box.
     * server/utils/auth.ts warns loudly if production runs on the fallback.
     */
    jwtSecret: process.env.JWT_SECRET || 'secret',

    /**
     * Payment provider credentials (ADR-015). ALL server-only — a secret key
     * under `public` would ship to the browser. Empty by default: the
     * registry falls back to the mock provider when a rail has no
     * credentials, so a missing key can never become a real charge.
     * See .env.example for the full set and where to obtain each one.
     */
    payments: {
      stripe: {
        secretKey: '', // NUXT_PAYMENTS_STRIPE_SECRET_KEY (sk_test_… / sk_live_…)
        webhookSecret: '', // NUXT_PAYMENTS_STRIPE_WEBHOOK_SECRET (whsec_…)
      },
      gocardless: {
        accessToken: '', // NUXT_PAYMENTS_GOCARDLESS_ACCESS_TOKEN (sandbox_… / live_…)
        webhookSecret: '', // NUXT_PAYMENTS_GOCARDLESS_WEBHOOK_SECRET
      },
      paypal: {
        clientId: '', // NUXT_PAYMENTS_PAYPAL_CLIENT_ID
        clientSecret: '', // NUXT_PAYMENTS_PAYPAL_CLIENT_SECRET
        webhookId: '', // NUXT_PAYMENTS_PAYPAL_WEBHOOK_ID
        environment: 'sandbox', // NUXT_PAYMENTS_PAYPAL_ENV
      },
    },

    public: {
      // mapbox config
      mapboxToken: '', // set it via NUXT_PUBLIC_MAPBOX_TOKEN env
      siteUrl: '', // set it via NUXT_PUBLIC_SITE_URL
      /**
       * Publishable keys only — these are designed to be public and are what
       * Stripe Elements / the PayPal JS SDK need in the browser. Never put a
       * secret key here.
       */
      payments: {
        stripePublishableKey: '', // NUXT_PUBLIC_PAYMENTS_STRIPE_PUBLISHABLE_KEY (pk_test_…)
        paypalClientId: '', // NUXT_PUBLIC_PAYMENTS_PAYPAL_CLIENT_ID
      },
    },
  },

  i18n: {
    baseUrl: '/',
    // We use no_prefix strategy to avoid having the locale prefix in the URL,
    // This may not be the best strategy for SEO, but it's the best for the demo.
    // We recommend using the default prefix_except_default strategy for SEO.
    strategy: 'no_prefix',
    defaultLocale: 'en',
    lazy: true,
    locales: [
      { code: 'en', dir: 'ltr', language: 'en-US', file: 'en-US.yaml', name: 'English', isCatchallLocale: true },
      { code: 'fr', dir: 'ltr', language: 'fr-FR', file: 'fr-FR.yaml', name: 'Français' },
      { code: 'es', dir: 'ltr', language: 'es-ES', file: 'es-ES.yaml', name: 'Español' },
      { code: 'de', dir: 'ltr', language: 'de-DE', file: 'de-DE.yaml', name: 'Deutsch' },
      { code: 'ar', dir: 'rtl', language: 'ar-SA', file: 'ar-SA.yaml', name: 'العربية' },
      { code: 'ja', dir: 'ltr', language: 'ja-JP', file: 'ja-JP.yaml', name: '日本語' },
    ],
    // Use i18n v10 features
    experimental: {
      generatedLocaleFilePathFormat: 'off',
    },
    bundle: {
      optimizeTranslationDirective: false,
    },
  },

  routeRules: {
    // UPDATED: Redirect root to personal dashboard
    '/': {
      redirect: '/dashboards/balance',
    },
    '/demos': {
      swr: 3600,
    },
    '/starters/**': {
      swr: 3600,
    },
    '/auth/**': {
      swr: 3600,
    },
    '/documentation': {
      swr: 3600,
    },
    '/documentation/**': {
      swr: 3600,
    },
    // Authenticated, per-user customer pages must NOT be SWR-cached: the first
    // (unauthenticated) render would otherwise be cached and served to everyone,
    // breaking auth and leaking the wrong content between users.
    '/dashboards/**': {
      swr: false,
    },
    // Admin panel: authenticated + role-gated, same no-cache rule.
    '/admin/**': {
      swr: false,
    },
    '/layouts/**': {
      swr: 3600,
    },
    '/wizard/**': {
      swr: 3600,
    },
  },

  sourcemap: {
    server: false,
    client: false,
  },

  nitro: {
    logging: {
      compressedSizes: false,
    },
    // Minifying the server bundle is the peak-memory stage of the build and
    // repeatedly OOM-killed the 4GB production VPS (the rollup pass holds the
    // whole bundle in memory twice). The server bundle is never downloaded by
    // a browser, so minifying it buys nothing but build risk — the client
    // assets are still minified by Vite. Same reasoning for source maps.
    minify: false,
    sourceMap: false,
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
    // No route needs static prerendering: this is a fully dynamic, authenticated
    // dashboard. The `/` redirect and every SWR rule are handled at runtime. Booting
    // a second in-process Nitro server to prerender the @nuxt/content SQL dump OOMs a
    // small VPS, so we switch it off entirely.
    prerender: {
      crawlLinks: false,
      routes: [],
    },
  },

  hooks: {
    // This is a fully dynamic, authenticated dashboard: nothing needs static
    // prerendering. Some module still queues prerender routes, and merely booting
    // the prerender server loads this heavyweight template's whole dependency graph
    // (mapbox-gl, apexcharts, zxcvbn packs…), which OOMs a small VPS. Neutralise it
    // both statically (build:before) and dynamically (prerender:routes fires right
    // before any route is rendered, so clearing there prevents the render pass).
    'nitro:build:before': (nitro) => {
      nitro.options.prerender ||= {}
      nitro.options.prerender.routes = []
      nitro.options.prerender.crawlLinks = false
      // Modules add prerender routes via the dynamic `prerender:routes` hook,
      // which fires just before any route is rendered — clear them there so the
      // render pass does nothing (the render, not the boot, is the memory cost).
      nitro.hooks.hook('prerender:routes', (routes) => {
        routes?.clear?.()
      })
    },
  },

  vite: {
    define: {
      // Enable / disable Options API support. Disabling this will result in smaller bundles,
      // but may affect compatibility with 3rd party libraries if they rely on Options API.
      __VUE_OPTIONS_API__: false,
    },
    css: {
      // LightningCSS is a rust based CSS minifier that is faster than the default CSS minifier.
      // @see https://vite.dev/guide/features.html#lightning-css
      // @see https://lightningcss.dev/
      transformer: 'lightningcss',
    },
    build: {
      target: 'esnext',
      cssMinify: 'lightningcss',
      reportCompressedSize: false,
    },
    // Defining the optimizeDeps.include option prebuilds the dependencies, this avoid
    // some reloads when navigating between pages during development.
    // It's also useful to track them usage.
    optimizeDeps: {
      include: [
        'scule',
        'klona',
        // AddonDatepicker
        'v-calendar',
        // AddonApexcharts
        'vue3-apexcharts',
        // AddonInputPhone
        'libphonenumber-js/max',
        'country-codes-list',
        // AddonInputPassword
        '@zxcvbn-ts/core',
        '@zxcvbn-ts/language-common',
        '@zxcvbn-ts/language-en',
        '@zxcvbn-ts/language-fr',
        // AddonMapboxLocationPicker
        'ohash',
        'mapbox-gl',
        '@mapbox/mapbox-gl-geocoder',
        // form validation
        '@vee-validate/zod',
        'vee-validate',
        'zod',
        // calendar app
        'vue3-smooth-dnd',
        'date-fns',
        'date-fns/locale',
        // profile edit page
        'imask',
      ],
    },
  },
})
