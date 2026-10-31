/**
 * The content contract for the site's code baseline.
 *
 * Every page's words are declared here as a template (plain TypeScript plus
 * zod, with no Nuxt imports) and filled in `app/data/cms-baseline.ts`. The
 * panel used to edit documents against these templates and the site laid
 * them over the baseline (ADR-021); that CMS was removed on 2026-10-31, so
 * the templates now only type the baseline and let the tests check it.
 *
 * Nothing here may import from `web/app` or `web/server`. Relative imports
 * carry their `.ts` extension so Node can run the test suites on these files
 * directly, without a bundler.
 */

export * from './fields.ts'
export * from './links.ts'
export * from './seo.ts'
export * from './templates.ts'
export * from './validate.ts'
