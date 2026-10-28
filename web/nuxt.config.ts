import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { company, seoDefaults } from './app/data/site'

const siteUrl = process.env.NUXT_PUBLIC_SITE_URL ?? 'https://apexdigi.co.uk'

// Every powerful browser feature is switched off: the site uses none of them.
const permissionsPolicy = [
  'accelerometer',
  'autoplay',
  'camera',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'geolocation',
  'gyroscope',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'publickey-credentials-get',
  'screen-wake-lock',
  'usb',
  'xr-spatial-tracking',
].map(feature => `${feature}=()`).join(', ')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/seo', // sitemap, robots, schema.org, canonical + meta helpers
    'nuxt-security', // CSP (nonce / hashes), HSTS, COOP/CORP, method + size limits
    '@nuxt/image', // AVIF/WebP + responsive srcset for real artwork
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  typescript: {
    strict: true,
  },

  // ---------------------------------------------------------------------------
  // Runtime configuration (override with NUXT_PUBLIC_* environment variables)
  // ---------------------------------------------------------------------------
  runtimeConfig: {
    /**
     * Where contact-form messages go (server-only; NUXT_CONTACT_* variables).
     * Until all three are set, POST /api/contact answers 503 and the form
     * offers the visitor's own email instead of claiming it sent anything.
     */
    contact: {
      resendApiKey: '',
      to: '',
      from: '',
    },
    /**
     * The panel that manages this site's content (ADR-021). `url` is where
     * the panel runs as seen from this server (NUXT_CMS_URL, e.g.
     * http://127.0.0.1:3000); empty renders the code baseline. `secret` is
     * the bearer token POST /api/cms/revalidate expects
     * (NUXT_CMS_REVALIDATE_SECRET, the same value as the panel's
     * NUXT_WEBSITE_REVALIDATE_SECRET); empty answers 503 there.
     */
    cms: {
      url: '',
      revalidateSecret: '',
    },
    public: {
      /** Customer panel (separate Nuxt app) — target of "Client login" and order links. */
      panelUrl: 'https://panel.apexdigi.co.uk',
      /** Baked at build so server and browser render the same © year. */
      buildYear: new Date().getFullYear(),
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      meta: [
        { name: 'theme-color', content: '#fdfdfd' },
        { name: 'color-scheme', content: 'light' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        // The two display weights used above the fold; everything else loads on demand.
        { rel: 'preload', as: 'font', type: 'font/woff', href: '/fonts/yellix/Yellix-ExtraBold.woff', crossorigin: 'anonymous' },
        { rel: 'preload', as: 'font', type: 'font/woff', href: '/fonts/yellix/Yellix-Bold.woff', crossorigin: 'anonymous' },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Rendering: every page is server-rendered per request over content the
  // server caches for 60 s (ADR-021), so a publish is visible on the next
  // request and every visitor gets a fresh CSP nonce. HTML-level swr is
  // deliberately not used: the route cache would replay one nonce.
  // ---------------------------------------------------------------------------
  routeRules: {
    '/**': { headers: { 'permissions-policy': permissionsPolicy } },
    // A draft preview: never cached, never indexed.
    '/preview/**': { cache: false, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } },
    // The panel's revalidate call: POST, small, server to server, authenticated by a bearer secret.
    '/api/cms/revalidate': {
      security: {
        allowedMethodsRestricter: { methods: ['POST'] },
        requestSizeLimiter: { maxRequestSizeInBytes: 8_000 },
        rateLimiter: false,
      },
    },
    // Same-origin content proxies for client-side navigation; the server's own cache bounds the work.
    '/api/cms/**': { security: { rateLimiter: false } },
    '/api/__sitemap__/**': { security: { rateLimiter: false } },
    // Images and library files: many per page, cached on disk, no per-IP limiter.
    '/_ipx/**': { security: { rateLimiter: false } },
    '/media/**': { security: { rateLimiter: false } },
    // The site's one write. POST is allowed here and nowhere else; the body is
    // small and each IP gets five messages per ten minutes.
    '/api/contact': {
      security: {
        allowedMethodsRestricter: { methods: ['POST'] },
        requestSizeLimiter: { maxRequestSizeInBytes: 16_000 },
        rateLimiter: { tokensPerInterval: 5, interval: 600_000 },
      },
    },
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/brand/**': { headers: { 'cache-control': 'public, max-age=604800' } },
    '/icons/**': { headers: { 'cache-control': 'public, max-age=604800' } },
  },

  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
    // The last good answer from the panel, on disk, so an outage renders the
    // last published words rather than the baseline (server/utils/cms.ts).
    storage: {
      cms: { driver: 'fs', base: '.data/cms' },
      // Processed images, by request path (server/routes/_ipx): IPX itself never caches.
      ipx: { driver: 'fs', base: '.data/ipx' },
    },
    devStorage: {
      cms: { driver: 'fs', base: '.data/cms' },
      ipx: { driver: 'fs', base: '.data/ipx' },
    },
  },

  // ---------------------------------------------------------------------------
  // SEO
  // ---------------------------------------------------------------------------
  site: {
    url: siteUrl,
    name: company.name,
    description: seoDefaults.description,
    defaultLocale: 'en-GB',
  },

  // The Organization identity is defined at request time in app.vue from
  // the site settings (ADR-021), so a changed phone number or profile URL
  // reaches structured data without a build.

  // The service-worker based skew protection is for apps with many concurrent
  // deploys; a prerendered marketing site gains nothing from it, and its worker
  // registration logs an error under the strict COEP header.
  skewProtection: { enabled: false },
  // The browser-side XSL stylesheet is an inline resource the strict CSP would block.
  // Every address comes from one server source (code pages plus the published
  // landing pages, ADR-021), not from the router: the catch-all and the preview
  // route must never be listed.
  sitemap: { xsl: false, sources: ['/api/__sitemap__/urls'], excludeAppSources: true },

  // TODO(seo): turn the link checker on once the remaining pages exist; it
  // would otherwise report every not-yet-built internal link as broken.
  linkChecker: { enabled: false },
  // TODO(seo): enable llms.txt / markdown-for-agents. nuxt-ai-ready needs the
  // native `@mdream/rust-win32-x64-msvc@2.0.3` binding, which the npm mirror in
  // `.npmrc` has not synced yet, so a Windows build fails with it switched on.
  aiReady: { enabled: false },
  // TODO(seo): per-page OG images (nuxt-og-image) for articles and case
  // studies; until then pages without artwork reference one static image.
  ogImage: { enabled: false },

  image: {
    quality: 80,
    format: ['avif', 'webp'],
  },

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------
  security: {
    // `strict` starts from the OWASP-style preset: default-src 'none', nonce /
    // hash based scripts and styles, COEP require-corp, 1-year preloadable HSTS.
    strict: true,
    headers: {
      contentSecurityPolicy: {
        'frame-ancestors': ['\'none\''],
      },
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      // Emitted by hand below: the strict preset includes `web-share`, which
      // browsers log as an unrecognised feature on every page load.
      permissionsPolicy: false,
    },
    // Pages and static files only; /api/contact opens POST in its route rule.
    allowedMethodsRestricter: { methods: ['GET', 'HEAD'] },
    // No cross-origin API is exposed, so no CORS headers are emitted.
    corsHandler: false,
  },
})
