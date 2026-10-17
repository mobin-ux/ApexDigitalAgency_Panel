import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { allCaseStudies } from './app/data/case-studies'
import { servicePagePaths } from './app/data/service-pages'
import { company, seoDefaults } from './app/data/site'

const profiles = company.social.filter(profile => profile.url).map(profile => profile.url)
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
  // Rendering: marketing pages are prerendered to static HTML at build time.
  // ---------------------------------------------------------------------------
  routeRules: {
    '/**': { headers: { 'permissions-policy': permissionsPolicy } },
    '/': { prerender: true },
    '/services': { prerender: true },
    '/our-work': { prerender: true },
    // A study without its written-up story is a short summary page: reachable
    // from its card, but kept out of search and the sitemap until it is written.
    ...Object.fromEntries(allCaseStudies.map(study => [
      `/our-work/${study.slug}`,
      study.story ? { prerender: true } : { prerender: true, robots: 'noindex, follow' },
    ])),
    ...Object.fromEntries(servicePagePaths.map(slug => [`/services/${slug}`, { prerender: true }])),
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/brand/**': { headers: { 'cache-control': 'public, max-age=604800' } },
    '/icons/**': { headers: { 'cache-control': 'public, max-age=604800' } },
  },

  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
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

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: company.name,
      legalName: company.legalName,
      logo: '/brand/apex-icon.svg',
      email: company.email,
      // Only confirmed facts reach structured data: empty values are dropped.
      ...(company.phone ? { telephone: company.phone } : {}),
      ...(profiles.length ? { sameAs: profiles } : {}),
      address: {
        addressLocality: company.address.locality,
        addressRegion: company.address.region,
        addressCountry: company.address.country,
      },
      areaServed: 'GB',
    },
  },

  // The service-worker based skew protection is for apps with many concurrent
  // deploys; a prerendered marketing site gains nothing from it, and its worker
  // registration logs an error under the strict COEP header.
  skewProtection: { enabled: false },
  // The browser-side XSL stylesheet is an inline resource the strict CSP would block.
  sitemap: { xsl: false },

  // TODO(seo): turn the link checker on once the remaining pages exist; it
  // would otherwise report every not-yet-built internal link as broken.
  linkChecker: { enabled: false },
  // TODO(seo): enable llms.txt / markdown-for-agents. nuxt-ai-ready needs the
  // native `@mdream/rust-win32-x64-msvc@2.0.3` binding, which the npm mirror in
  // `.npmrc` has not synced yet, so a Windows build fails with it switched on.
  aiReady: { enabled: false },
  // TODO(seo): per-page OG images (nuxt-og-image) when article pages exist;
  // until then a single static image is referenced from the homepage.
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
    // The site serves pages and static files only.
    allowedMethodsRestricter: { methods: ['GET', 'HEAD'] },
    // No cross-origin API is exposed, so no CORS headers are emitted.
    corsHandler: false,
  },
})
