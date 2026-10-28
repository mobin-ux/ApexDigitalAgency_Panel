/**
 * The website CMS contract, re-exported from the site (`web/shared/cms`).
 *
 * The site owns the shape of its content; the panel stores and edits it. One
 * module read from both trees is what keeps the editor's validation and the
 * site's rendering the same thing (ADR-021). The import is relative on purpose:
 * `web/` is a separate pnpm project (ADR-018), so nothing here goes through a
 * package name, and the panel bundles the files straight from the site tree.
 */
export * from '../../web/shared/cms/index.ts'
