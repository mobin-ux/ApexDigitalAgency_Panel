export default defineNuxtConfig({
  app: {
    baseURL: '/',
    cdnURL: '',
  },
  // ------------------------------------------

  compatibilityDate: '2025-03-05',
  future: {
    compatibilityVersion: 4,
  },
  extends: [
    /**
     * This extends the base Tairo layer.
     *
     * Alternatively you can use the following:
     * ["gh:cssninjaStudio/tairo/layers/tairo#v1.4.0", {
     *    install: true,
     *    auth: import.meta.env.GITHUB_TOKEN,
     * }]
     *
     * @see https://github.com/unjs/c12#extending-config-layer-from-remote-sources
     *
     * This would allows you to create an empty git repository
     * with only your source code and no demo.
     */

    '../layers/tairo',
  ],

  css: [
    /**
     * Load Tailwind CSS
     */
    '~/assets/main.css',
  ],
})
