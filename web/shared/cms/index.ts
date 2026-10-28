/**
 * The CMS content contract shared by the site and the panel.
 *
 * The site owns the rendering contract: every editable field a page template
 * exposes, every landing-page section type, the SEO object and the link rules
 * are declared here, as plain TypeScript plus zod, with no Nuxt, Prisma or
 * JWT imports. The panel imports this module by relative path
 * (`.demo/shared/cms.ts`) so the editor validates exactly what the site will
 * render, and the two cannot drift (ADR-021).
 *
 * Nothing here may import from `web/app` or `web/server`. Relative imports
 * carry their `.ts` extension so Node can run the test suites on these files
 * directly, without a bundler.
 */

/** Bumped when a stored document shape changes in a way old readers cannot resolve. */
export const CMS_CONTRACT_VERSION = 1 as const

export * from './blocks.ts'
export * from './fields.ts'
export * from './links.ts'
export * from './resolve.ts'
export * from './sections.ts'
export * from './seo.ts'
export * from './templates.ts'
export * from './workflow.ts'
