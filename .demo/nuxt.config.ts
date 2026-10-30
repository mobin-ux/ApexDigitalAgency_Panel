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
   *
   * `interactive-widget=resizes-content` makes the on-screen keyboard SHRINK
   * the viewport instead of overlaying it (V2 Phase 9). Combined with the
   * `dvh` units the pages already use, that keeps a focused composer or a
   * sticky action bar above the keyboard rather than hidden behind it — the
   * Support reply box being the case that matters most.
   */
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
    },
  },

  /**
   * Panel v2 follows the website: light by default, dark on the customer's
   * toggle (top bar, account menu, Settings › Appearance). The choice is
   * remembered per browser by the module. `classSuffix: ''` keeps the class as
   * `.dark`, which is what main.css keys both token sets on.
   *
   * The admin panel and the auth/legal screens were designed and measured on
   * the dark theme only, so `pages:extend` below pins them to it — the customer
   * panel going light must not drag those screens into a theme they have
   * never been checked in.
   */
  colorMode: {
    preference: 'light',
    fallback: 'light',
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
    /**
     * Where client uploads (brief files, project files, support attachments)
     * are stored. Override with NUXT_UPLOAD_DIR; production points it outside
     * the deployed bundle so a release never deletes customer files.
     */
    uploadDir: '',
    /** Companies House public data API key (NUXT_COMPANIES_HOUSE_KEY). Empty hides the lookup. */
    companiesHouseKey: '',
    /**
     * The public website this panel manages (ADR-021). `siteUrl` is where
     * the site runs as seen from this server (NUXT_WEBSITE_SITE_URL, e.g.
     * http://127.0.0.1:3100); `revalidateSecret` is the bearer token the
     * site expects on POST /api/cms/revalidate (NUXT_WEBSITE_REVALIDATE_SECRET,
     * the same value as the site's NUXT_CMS_REVALIDATE_SECRET). Empty means
     * no site is attached: previews have no link and publishes skip the call.
     */
    website: {
      siteUrl: '',
      revalidateSecret: '',
      /** Where the website media library stores files (NUXT_WEBSITE_MEDIA_DIR); outside the bundle in production. */
      mediaDir: '',
    },
    /**
     * Outgoing email (ADR-022): Resend over REST, the same provider the
     * public site's contact form uses. `from` must be an address on a
     * domain verified with Resend (NUXT_MAIL_FROM, e.g.
     * "Apex Digital Agency <no-reply@apexdigi.co.uk>"). With either key
     * empty nothing is sent: messages are still queued, marked failed with
     * the reason, and every screen says so instead of claiming an email went.
     */
    mail: {
      resendApiKey: '', // NUXT_MAIL_RESEND_API_KEY
      from: '', // NUXT_MAIL_FROM
    },
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
    /*
     * The auth pages must not be HTML-cached (found in V2 Phase 8).
     *
     * With `swr: 3600` Nitro served an hour-old render of the sign-in page: the
     * cached HTML no longer matched the client bundle, so every visit logged a
     * hydration mismatch and Vue re-rendered the shell. It also means a shipped
     * change to the login form is invisible for up to an hour after deploy, and
     * `/auth/recover` is served per-token — a route whose output depends on a
     * `?token=` query is the last thing that should come from a shared cache.
     *
     * Same reasoning as `/dashboards/**` below (ADR-008), which is where this
     * rule was first learned.
     */
    '/auth/**': {
      swr: false,
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
  },

  sourcemap: {
    server: false,
    client: false,
  },

  nitro: {
    logging: {
      compressedSizes: false,
    },
    // Ship a Brotli and a gzip copy of every client asset beside it, so the
    // server answers `Accept-Encoding: br` with the precompressed file. Caddy
    // and Cloudflare only ever compressed these on the fly at a fast level
    // (gzip ≈ zstd, the entry chunk 184 KB); Brotli at build time is about a
    // quarter smaller, which is what a slow or lossy connection feels.
    compressPublicAssets: { gzip: true, brotli: true },
    // The website CMS scheduler (ADR-021): one in-process cron that publishes
    // documents whose time has come. The panel runs as a single node-server
    // process, so there is exactly one.
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '* * * * *': ['website:publish-due', 'mail:deliver'],
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
    'pages:extend': (pages) => {
      const pinDark = (list: typeof pages) => {
        for (const page of list) {
          if (/^\/(?:admin|auth|legal)(?:\/|$)/.test(page.path)) {
            page.meta = { ...page.meta, colorMode: 'dark' }
          }
          if (page.children?.length) {
            pinDark(page.children)
          }
        }
      }
      pinDark(pages)
    },
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
