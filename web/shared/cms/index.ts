/**
 * The content contract shared by the site and the admin console (ADR-026).
 *
 * Every coded page's words are declared here as a template (plain TypeScript
 * plus zod, with no Nuxt imports) and filled in `app/data/cms-baseline.ts`.
 * The console edits documents against these templates and the section types
 * in `sections.ts`; the site lays what is published over its baseline
 * (`resolve.ts`) and renders built documents section by section.
 *
 * Nothing here may import from `web/app` or `web/server`. Relative imports
 * carry their `.ts` extension so Node can run the test suites on these files
 * directly, without a bundler.
 */

export * from './documents.ts'
export * from './fields.ts'
export * from './links.ts'
export * from './resolve.ts'
export * from './sections.ts'
export * from './seo.ts'
export * from './templates.ts'
export * from './validate.ts'
