import type { FieldMap, InferMap } from './fields.ts'
import { f } from './fields.ts'
import { PAGE_TEMPLATES } from './pages.ts'
import { sectionsField } from './sections.ts'
import { seoField } from './seo.ts'

/**
 * What each kind of document can hold.
 *
 * - `page`: a URL on the public site. The core templates (home, services,
 *   about …) expose the fields of the page the site already renders from
 *   code; `landing` is a free page built from sections.
 * - `global`: the chrome every page shares — header, footer, announcement.
 * - `panel`: customer-facing documents the panel shows — legal text, the
 *   dashboard promo, a panel-wide announcement.
 *
 * A document's `key` is its path for a page, and the fixed key for a global
 * or panel document (one each). The core page templates live in pages.ts;
 * the free-form and chrome templates are here.
 */

export type TemplateKind = 'page' | 'global' | 'panel'

export interface TemplateDef<F extends FieldMap = FieldMap> {
  label: string
  detail: string
  kind: TemplateKind
  /** Globals and panel documents exist once, at this key; pages are keyed by path. */
  fixedKey?: string
  fields: F
}

const announcementFields = {
  enabled: f.boolean({ label: 'Show the bar', hint: 'Off keeps the text ready without showing it.' }),
  text: f.text({ label: 'Message', hint: 'The bar shows only when it is on and has a message.', max: 200 }),
  link: f.optional(f.object({
    label: 'Link',
    fields: {
      label: f.text({ label: 'Link text', max: 40, required: true }),
      link: f.link({ label: 'Goes to' }),
    },
  })),
  tone: f.select({ label: 'Tone', options: [
    { value: 'info', label: 'Neutral' },
    { value: 'success', label: 'Positive' },
    { value: 'warning', label: 'Attention' },
  ] }),
  startsAt: f.text({ label: 'Show from', hint: 'Optional. UK time, as YYYY-MM-DDTHH:MM.', max: 25, format: 'datetime' }),
  endsAt: f.text({ label: 'Show until', hint: 'Optional. UK time, as YYYY-MM-DDTHH:MM.', max: 25, format: 'datetime' }),
} as const

const navLink = f.object({
  label: 'Link',
  fields: {
    label: f.text({ label: 'Text', max: 40, required: true }),
    link: f.link({ label: 'Goes to' }),
  },
})

export const TEMPLATES = {
  ...PAGE_TEMPLATES,
  'landing': {
    label: 'Landing page',
    detail: 'A page built from sections, at any address that is free',
    kind: 'page',
    fields: {
      title: f.text({ label: 'Page name', hint: 'Shown in the panel and as the default search title.', max: 120, required: true }),
      sections: sectionsField,
      seo: seoField,
    },
  },
  'header': {
    label: 'Header',
    detail: 'The main menu and the sign-in buttons on every page',
    kind: 'global',
    fixedKey: 'header',
    fields: {
      nav: f.list({ label: 'Menu', hint: 'Services keeps its own menu; these sit beside it.', min: 1, max: 6, item: navLink }),
      signIn: f.text({ label: 'Sign-in button', max: 30, required: true }),
      start: f.text({ label: 'Start button', max: 30, required: true }),
      servicesLabel: f.text({ label: 'Services menu label', max: 30, required: true }),
      allServices: f.text({ label: 'All-services link', max: 30, required: true }),
      menuDescription: f.text({ label: 'Menu description', hint: 'Read by screen readers when the mobile menu opens.', max: 160 }),
      sections: f.object({
        label: 'Section names',
        hint: 'Used in breadcrumbs.',
        fields: {
          home: f.text({ label: 'Home', max: 20, required: true }),
          services: f.text({ label: 'Services', max: 20, required: true }),
          ourWork: f.text({ label: 'Our work', max: 20, required: true }),
          insights: f.text({ label: 'Insights', max: 20, required: true }),
          about: f.text({ label: 'About', max: 20, required: true }),
          contact: f.text({ label: 'Contact', max: 20, required: true }),
        },
      }),
    },
  },
  'footer': {
    label: 'Footer',
    detail: 'The talk-first strip, the link columns and the legal line',
    kind: 'global',
    fixedKey: 'footer',
    fields: {
      strip: f.object({
        label: 'Top strip',
        fields: {
          title: f.text({ label: 'Heading', max: 80, required: true }),
          text: f.text({ label: 'Line', max: 160 }),
        },
      }),
      groups: f.list({
        label: 'Link columns',
        min: 1,
        max: 4,
        item: f.object({
          label: 'Column',
          fields: {
            label: f.text({ label: 'Heading', max: 40, required: true }),
            links: f.list({ label: 'Links', min: 1, max: 8, item: navLink }),
          },
        }),
      }),
      button: f.text({ label: 'Strip button', max: 40, required: true }),
      servicesLabel: f.text({ label: 'Services column heading', max: 30, required: true }),
      registeredIn: f.text({ label: 'Registered-in line', hint: 'The country comes from site settings.', max: 40, required: true }),
    },
  },
  'announcement': {
    label: 'Announcement bar',
    detail: 'One line above the header on the public site',
    kind: 'global',
    fixedKey: 'announcement',
    fields: announcementFields,
  },
  'legal': {
    label: 'Legal document',
    detail: 'Terms, privacy and the other policies, as structured text',
    kind: 'panel',
    fields: {
      title: f.text({ label: 'Title', max: 120, required: true }),
      updated: f.text({ label: 'Last updated', hint: 'YYYY-MM-DD', max: 10, format: 'date' }),
      blocks: f.blocks({ label: 'Document', max: 300 }),
    },
  },
  'panel-promo': {
    label: 'Dashboard promo',
    detail: 'The pay-monthly band on the customer dashboard',
    kind: 'panel',
    fixedKey: 'dashboard-promo',
    fields: {
      eyebrow: f.text({ label: 'Eyebrow', max: 40, required: true }),
      title: f.text({ label: 'Headline', max: 80, required: true }),
      text: f.textarea({ label: 'Text', max: 240, required: true }),
      button: f.text({ label: 'Button', max: 30, required: true }),
      finePrint: f.text({ label: 'Fine print', hint: 'The deposit and monthly figures are added from the catalogue.', max: 160 }),
    },
  },
  'panel-announcement': {
    label: 'Panel announcement',
    detail: 'One line above every customer page in the panel',
    kind: 'panel',
    fixedKey: 'panel-announcement',
    fields: announcementFields,
  },
} as const satisfies Record<string, TemplateDef>

export type TemplateKey = keyof typeof TEMPLATES

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[]

export type TemplateContent<T extends TemplateKey> = InferMap<typeof TEMPLATES[T]['fields']>

export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === 'string' && value in TEMPLATES
}

/** Templates a staff member may create a new document from; the fixed ones exist once and are created by the import. */
export function creatableTemplates(): TemplateKey[] {
  return TEMPLATE_KEYS.filter(key => !(TEMPLATES[key] as TemplateDef).fixedKey)
}
