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
 * Nothing here may import from `web/app` or `web/server`.
 */

/** Bumped when a stored document shape changes in a way old readers cannot resolve. */
export const CMS_CONTRACT_VERSION = 1 as const
