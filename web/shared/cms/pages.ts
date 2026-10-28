import type { TemplateDef } from './templates.ts'
import { f } from './fields.ts'
import { seoField } from './seo.ts'

/**
 * The core page templates: what a staff member can change on each page the
 * site renders from code. Every field here is copy — headings, lines,
 * labels, questions and answers. Prices, counts, routes and the catalogues
 * (services, plans, projects, articles, people) stay in code and are never
 * editable, so a page cannot be made to quote a figure the business does
 * not charge. The `*-chrome` globals hold the words shared by every page of
 * a dynamic template (service, case study, article).
 */

const cta = f.object({
  label: 'Button',
  fields: {
    label: f.text({ label: 'Label', max: 40, required: true }),
    link: f.link({ label: 'Goes to' }),
  },
})

function header(hint?: string) {
  return {
    eyebrow: f.text({ label: 'Eyebrow', max: 60 }),
    title: f.text({ label: 'Heading', max: 140, required: true, hint }),
  }
}

const faqItems = f.list({
  label: 'Questions',
  min: 1,
  max: 20,
  item: f.object({
    label: 'Question',
    fields: {
      question: f.text({ label: 'Question', max: 200, required: true }),
      answer: f.textarea({ label: 'Answer', max: 1200, required: true }),
    },
  }),
})

const stat = f.object({
  label: 'Figure',
  fields: {
    value: f.text({ label: 'Value', max: 24, required: true }),
    label: f.text({ label: 'Label', max: 80, required: true }),
  },
})

const titledBody = f.object({
  label: 'Item',
  fields: {
    title: f.text({ label: 'Title', max: 120, required: true }),
    body: f.textarea({ label: 'Text', max: 400, required: true }),
  },
})

export const PAGE_TEMPLATES = {
  'home': {
    label: 'Homepage',
    detail: 'The front page: hero, sections, questions and the closing panel',
    kind: 'page',
    fixedKey: '/',
    fields: {
      hero: f.object({
        label: 'Hero',
        fields: {
          chip: f.text({ label: 'Chip', max: 60 }),
          title: f.text({ label: 'Headline', max: 80, required: true }),
          lead: f.textarea({ label: 'Lead', max: 400, required: true }),
          primary: cta,
          secondary: cta,
          stats: f.list({ label: 'Figures', min: 1, max: 3, item: stat }),
        },
      }),
      clients: f.object({
        label: 'Client strip',
        fields: {
          title: f.text({ label: 'Heading', max: 80, required: true }),
          names: f.list({ label: 'Names', hint: 'Until the real logos arrive these render as names.', min: 1, max: 8, item: f.text({ label: 'Name', max: 40, required: true }) }),
        },
      }),
      services: f.object({
        label: 'Services section',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Intro', max: 300 }),
          all: f.text({ label: 'All-services link', max: 40, required: true }),
        },
      }),
      monthly: f.object({
        label: 'Pay monthly section',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Intro', max: 400 }),
          steps: f.list({ label: 'Steps', min: 1, max: 4, item: titledBody }),
          finalStep: titledBody,
        },
      }),
      work: f.object({
        label: 'Work section',
        fields: {
          ...header(),
          all: f.text({ label: 'All-work link', max: 40, required: true }),
        },
      }),
      why: f.object({
        label: 'Why section',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Intro', max: 300 }),
          swaps: f.list({
            label: 'Swaps',
            min: 1,
            max: 4,
            item: f.object({
              label: 'Swap',
              fields: {
                before: f.text({ label: 'Crossed out', max: 60, required: true }),
                after: f.text({ label: 'Instead', max: 60, required: true }),
                note: f.text({ label: 'Note', max: 100 }),
              },
            }),
          }),
          trust: f.list({
            label: 'Trust marks',
            min: 1,
            max: 4,
            item: f.object({ label: 'Mark', fields: { title: f.text({ label: 'Title', max: 40, required: true }), note: f.text({ label: 'Note', max: 80 }) } }),
          }),
        },
      }),
      insights: f.object({
        label: 'Insights section',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Intro', max: 300 }),
          all: f.text({ label: 'All-insights link', max: 40, required: true }),
        },
      }),
      faq: f.object({ label: 'Questions', fields: { ...header(), items: faqItems } }),
      cta: f.object({
        label: 'Closing panel',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Text', max: 300 }),
          button: f.text({ label: 'Button', max: 40, required: true }),
          replyLabel: f.text({ label: 'Reply card label', max: 40, required: true }),
          replyValue: f.text({ label: 'Reply card value', max: 60, required: true }),
          clientLabel: f.text({ label: 'Client card label', max: 40, required: true }),
          clientValue: f.text({ label: 'Client card link', max: 60, required: true }),
          whereLabel: f.text({ label: 'Location card label', max: 40, required: true }),
        },
      }),
      seo: seoField,
    },
  },

  'services': {
    label: 'Services page',
    detail: 'The services overview: finder, combinations, ordering steps and the closing panel',
    kind: 'page',
    fixedKey: '/services',
    fields: {
      hero: f.object({
        label: 'Hero',
        fields: {
          chip: f.text({ label: 'Chip', max: 40 }),
          title: f.text({ label: 'Headline', max: 100, required: true }),
          lead: f.textarea({ label: 'Lead', max: 400, required: true }),
        },
      }),
      finder: f.object({
        label: 'Finder',
        fields: {
          title: f.text({ label: 'Question', max: 80, required: true }),
          hint: f.text({ label: 'Hint', max: 80 }),
          all: f.text({ label: 'Show-all chip', max: 40, required: true }),
          emptyTitle: f.text({ label: 'No-match heading', max: 80, required: true }),
          emptyBody: f.textarea({ label: 'No-match text', max: 300 }),
          emptyButton: f.text({ label: 'No-match button', max: 40, required: true }),
        },
      }),
      combinations: f.object({ label: 'Combinations', fields: { ...header(), text: f.textarea({ label: 'Intro', max: 300 }) } }),
      ordering: f.object({
        label: 'How ordering works',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Intro', max: 300 }),
          button: f.text({ label: 'Button', max: 40, required: true }),
          steps: f.list({
            label: 'Steps',
            min: 1,
            max: 4,
            item: f.object({ label: 'Step', fields: { title: f.text({ label: 'Title', max: 60, required: true }), where: f.text({ label: 'Where', max: 60 }) } }),
          }),
        },
      }),
      cta: f.object({
        label: 'Closing panel',
        fields: {
          ...header(),
          text: f.textarea({ label: 'Text', max: 300 }),
          button: f.text({ label: 'Button', max: 40, required: true }),
          replyNote: f.text({ label: 'Reply line', max: 60, required: true }),
        },
      }),
      seo: seoField,
    },
  },

  'our-work': {
    label: 'Our work page',
    detail: 'The case-study list: hero, next-project card, client quotes and the closing panel',
    kind: 'page',
    fixedKey: '/our-work',
    fields: {
      hero: f.object({ label: 'Hero', fields: { ...header(), lead: f.textarea({ label: 'Lead', max: 400, required: true }) } }),
      next: f.object({
        label: 'Next project card',
        fields: {
          title: f.text({ label: 'Heading', max: 100, required: true }),
          body: f.textarea({ label: 'Text', max: 300 }),
          checks: f.list({ label: 'Ticks', min: 1, max: 4, item: f.text({ label: 'Tick', max: 60, required: true }) }),
          button: f.text({ label: 'Button', max: 40, required: true }),
        },
      }),
      voices: f.object({
        label: 'Client quotes',
        fields: {
          ...header(),
          intro: f.textarea({ label: 'Intro', max: 300 }),
          quotes: f.list({
            label: 'Quotes',
            min: 1,
            max: 6,
            item: f.object({
              label: 'Quote',
              fields: {
                quote: f.textarea({ label: 'Quote', max: 500, required: true }),
                name: f.text({ label: 'Name', max: 80, required: true }),
                role: f.text({ label: 'Role and company', max: 120 }),
                result: f.text({ label: 'Result chip', max: 30 }),
              },
            }),
          }),
        },
      }),
      cta: f.object({ label: 'Closing panel', fields: { ...header(), body: f.textarea({ label: 'Text', max: 300 }), button: f.text({ label: 'Button', max: 40, required: true }) } }),
      seo: seoField,
    },
  },

  'insights': {
    label: 'Insights page',
    detail: 'The article index: hero and search, browse labels, quick answers and the closing panel',
    kind: 'page',
    fixedKey: '/insights',
    fields: {
      hero: f.object({
        label: 'Hero',
        fields: {
          ...header(),
          lead: f.textarea({ label: 'Lead', max: 400, required: true }),
          searchLabel: f.text({ label: 'Search label', max: 40, required: true }),
          searchPlaceholder: f.text({ label: 'Search placeholder', max: 80 }),
          searchButton: f.text({ label: 'Search button', max: 20, required: true }),
          popularLabel: f.text({ label: 'Popular label', max: 30 }),
          popular: f.list({
            label: 'Popular searches',
            max: 5,
            item: f.object({ label: 'Search', fields: { label: f.text({ label: 'Chip', max: 30, required: true }), query: f.text({ label: 'Searches for', max: 60, required: true }) } }),
          }),
        },
      }),
      featured: f.object({ label: 'Featured', fields: { read: f.text({ label: 'Read link', max: 30, required: true }), upcomingTitle: f.text({ label: 'Upcoming heading', max: 40, required: true }) } }),
      browse: f.object({
        label: 'Browse',
        fields: {
          title: f.text({ label: 'Heading', max: 60, required: true }),
          allTopics: f.text({ label: 'All-topics chip', max: 30, required: true }),
          clear: f.text({ label: 'Clear link', max: 30, required: true }),
          emptyTitle: f.text({ label: 'No-match heading', max: 80, required: true }),
          emptyBody: f.textarea({ label: 'No-match text', max: 300 }),
          emptyButton: f.text({ label: 'No-match button', max: 40, required: true }),
          relatedService: f.text({ label: 'Related-service label', max: 30, required: true }),
        },
      }),
      costs: f.object({
        label: 'Quick answers',
        fields: {
          ...header(),
          lead: f.textarea({ label: 'Intro', max: 300 }),
          compare: f.text({ label: 'Compare link', max: 40, required: true }),
          market: f.text({ label: 'Market label', max: 30, required: true }),
          withApex: f.text({ label: 'Apex label', max: 30, required: true }),
          quotedLabel: f.text({ label: 'Quoted label', max: 30, required: true }),
          quotedValue: f.text({ label: 'Quoted value', max: 30, required: true }),
          items: f.list({
            label: 'Answers',
            min: 1,
            max: 8,
            item: f.object({
              label: 'Answer',
              fields: {
                question: f.text({ label: 'Question', max: 120, required: true }),
                market: f.text({ label: 'Typical UK range', max: 60, required: true }),
                service: f.select({ label: 'Service', options: [
                  { value: 'website-design', label: 'Website Design' },
                  { value: 'software-development', label: 'Software Development' },
                  { value: 'digital-marketing', label: 'Digital Marketing' },
                  { value: 'seo', label: 'SEO' },
                  { value: 'ppc', label: 'PPC' },
                  { value: 'ui-ux-design', label: 'UI/UX Design' },
                  { value: 'branding', label: 'Branding' },
                ] }),
              },
            }),
          }),
        },
      }),
      cta: f.object({
        label: 'Closing panel',
        fields: {
          ...header(),
          body: f.textarea({ label: 'Text', max: 300 }),
          button: f.text({ label: 'Button', max: 40, required: true }),
          checks: f.list({ label: 'Ticks', max: 4, item: f.text({ label: 'Tick', max: 60, required: true }) }),
        },
      }),
      seo: seoField,
    },
  },

  'about': {
    label: 'About page',
    detail: 'The company page: hero, promises, team copy, paperwork, story, studio and the closing panel',
    kind: 'page',
    fixedKey: '/about',
    fields: {
      hero: f.object({
        label: 'Hero',
        fields: {
          ...header(),
          lead: f.textarea({ label: 'Lead', max: 500, required: true }),
          teamLink: f.text({ label: 'Team link', max: 30, required: true }),
          companyLink: f.text({ label: 'Company link', max: 30, required: true }),
          photoCaption: f.text({ label: 'Team photo caption', max: 100 }),
        },
      }),
      promises: f.object({ label: 'Promises', fields: { ...header(), lead: f.textarea({ label: 'Intro', max: 300 }), items: f.list({ label: 'Promises', min: 1, max: 6, item: titledBody }) } }),
      team: f.object({
        label: 'Team section',
        fields: {
          ...header(),
          lead: f.textarea({ label: 'Intro', max: 300 }),
          everyone: f.text({ label: 'All-departments chip', max: 20, required: true }),
          filterLabel: f.text({ label: 'Filter label', max: 60, required: true }),
          since: f.text({ label: 'Since line', hint: '{year} becomes the year they joined.', max: 30, required: true, placeholders: ['year'] }),
          hiring: f.object({
            label: 'Hiring card',
            fields: {
              title: f.text({ label: 'Heading', hint: 'Empty hides the card.', max: 80 }),
              body: f.textarea({ label: 'Text', max: 200 }),
              link: f.text({ label: 'Link', max: 30 }),
            },
          }),
        },
      }),
      paperwork: f.object({
        label: 'Paperwork',
        fields: {
          ...header(),
          lead: f.textarea({ label: 'Intro', max: 300 }),
          requestText: f.text({ label: 'Request line', max: 160 }),
          requestLink: f.text({ label: 'Request link', max: 30, required: true }),
          requestSubject: f.text({ label: 'Email subject', max: 80, required: true }),
        },
      }),
      story: f.object({
        label: 'Story',
        fields: {
          ...header(),
          milestones: f.list({
            label: 'Milestones',
            min: 1,
            max: 8,
            item: f.object({ label: 'Milestone', fields: { when: f.text({ label: 'When', max: 30, required: true }), title: f.text({ label: 'Title', max: 60, required: true }), body: f.textarea({ label: 'Text', max: 200 }) } }),
          }),
        },
      }),
      visit: f.object({
        label: 'Visit the studio',
        fields: {
          ...header(),
          body: f.textarea({ label: 'Text', max: 300 }),
          button: f.text({ label: 'Button', max: 40, required: true }),
          directions: f.text({ label: 'Directions link', max: 30, required: true }),
        },
      }),
      cta: f.object({ label: 'Closing panel', fields: { ...header(), body: f.textarea({ label: 'Text', max: 300 }), button: f.text({ label: 'Button', max: 40, required: true }) } }),
      seo: seoField,
    },
  },

  'contact': {
    label: 'Contact page',
    detail: 'The contact page: hero, figures, form labels, what happens next, studio and questions',
    kind: 'page',
    fixedKey: '/contact',
    fields: {
      hero: f.object({ label: 'Hero', fields: { ...header(), lead: f.textarea({ label: 'Lead', max: 400, required: true }) } }),
      stats: f.list({ label: 'Figures', hint: 'An empty value hides its row.', max: 3, item: f.object({ label: 'Figure', fields: { value: f.text({ label: 'Value', max: 20 }), label: f.text({ label: 'Label', max: 80, required: true }) } }) }),
      form: f.object({
        label: 'Form',
        fields: {
          title: f.text({ label: 'Heading', max: 60, required: true }),
          intro: f.text({ label: 'Intro', max: 160 }),
          servicesLabel: f.text({ label: 'Services label', max: 60, required: true }),
          servicesHint: f.text({ label: 'Services hint', max: 60 }),
          budgetLabel: f.text({ label: 'Budget label', max: 60, required: true }),
          budgetHint: f.text({ label: 'Budget hint', max: 120 }),
          replyLabel: f.text({ label: 'Reply-by label', max: 60, required: true }),
          submit: f.text({ label: 'Send button', max: 30, required: true }),
          hintReady: f.text({ label: 'Ready hint', max: 120 }),
          hintMissing: f.text({ label: 'Missing hint', max: 120 }),
        },
      }),
      steps: f.object({ label: 'What happens next', fields: { label: f.text({ label: 'Heading', max: 40, required: true }), items: f.list({ label: 'Steps', min: 1, max: 4, item: titledBody }) } }),
      studio: f.object({
        label: 'Studio',
        fields: {
          eyebrow: f.text({ label: 'Eyebrow', max: 40 }),
          travel: f.text({ label: 'Travel line', hint: 'Shown only once the street address is confirmed.', max: 200 }),
          byAppointment: f.text({ label: 'Visits line', max: 60 }),
          directions: f.text({ label: 'Directions link', max: 30, required: true }),
          teamLink: f.text({ label: 'Team link', max: 30, required: true }),
        },
      }),
      faq: f.object({ label: 'Questions', fields: { ...header(), intro: f.textarea({ label: 'Intro', max: 300 }), items: faqItems } }),
      seo: seoField,
    },
  },

  'service': {
    label: 'Service page',
    detail: 'One service: its hero, questions and closing panel. Plans and prices stay in the catalogue.',
    kind: 'page',
    fields: {
      hero: f.object({
        label: 'Hero',
        fields: {
          badge: f.text({ label: 'Badge', max: 60 }),
          title: f.text({ label: 'Headline', max: 120, required: true }),
          lead: f.textarea({ label: 'Lead', max: 500, required: true }),
          checks: f.list({ label: 'Ticks', max: 4, item: f.text({ label: 'Tick', max: 60, required: true }) }),
        },
      }),
      faq: f.object({ label: 'Questions', fields: { title: f.text({ label: 'Heading', max: 120, required: true }), items: faqItems } }),
      cta: f.object({ label: 'Closing panel', fields: { title: f.text({ label: 'Heading', max: 120, required: true }), body: f.textarea({ label: 'Text', max: 300 }) } }),
      seo: seoField,
    },
  },

  'case-study': {
    label: 'Case study',
    detail: 'One case study: its title, lead and search listing. Figures stay in the catalogue.',
    kind: 'page',
    fields: {
      title: f.text({ label: 'Headline', max: 140, required: true }),
      lead: f.textarea({ label: 'Lead', max: 500 }),
      seo: seoField,
    },
  },

  'article': {
    label: 'Article',
    detail: 'One article: its title, excerpt, lead and search listing. The body stays in the catalogue.',
    kind: 'page',
    fields: {
      title: f.text({ label: 'Title', max: 140, required: true }),
      excerpt: f.textarea({ label: 'Excerpt', max: 300 }),
      lead: f.textarea({ label: 'Lead', max: 500 }),
      seo: seoField,
    },
  },

  'service-chrome': {
    label: 'Service page chrome',
    detail: 'Words every service page shares',
    kind: 'global',
    fixedKey: 'service-chrome',
    fields: {
      ctaEyebrow: f.text({ label: 'Closing panel eyebrow', max: 40 }),
      call: f.text({ label: 'Call button', max: 40, required: true }),
      emailLabel: f.text({ label: 'Email label', max: 20, required: true }),
      phoneLabel: f.text({ label: 'Phone label', max: 20, required: true }),
    },
  },

  'case-study-chrome': {
    label: 'Case study chrome',
    detail: 'Words every case study shares',
    kind: 'global',
    fixedKey: 'case-study-chrome',
    fields: {
      sideTitle: f.text({ label: 'Side card heading', max: 60, required: true }),
      sideButton: f.text({ label: 'Side card button', max: 40, required: true }),
      fallbackEyebrow: f.text({ label: 'Summary-page eyebrow', max: 40 }),
      fallbackTitle: f.text({ label: 'Summary-page heading', max: 100, required: true }),
      fallbackBody: f.textarea({ label: 'Summary-page text', max: 300 }),
      checks: f.list({ label: 'Ticks', max: 3, item: f.text({ label: 'Tick', max: 60, required: true }) }),
      button: f.text({ label: 'Order button', max: 40, required: true }),
      call: f.text({ label: 'Call link', max: 60, required: true }),
      moreEyebrow: f.text({ label: 'Similar projects eyebrow', max: 40 }),
      moreTitle: f.text({ label: 'Similar projects heading', max: 60, required: true }),
      moreLink: f.text({ label: 'All-work link', max: 30, required: true }),
    },
  },

  'article-chrome': {
    label: 'Article chrome',
    detail: 'Words every article shares',
    kind: 'global',
    fixedKey: 'article-chrome',
    fields: {
      updated: f.text({ label: 'Updated label', max: 20, required: true }),
      byline: f.text({ label: 'Byline', hint: '{role} and {minutes} are filled in.', max: 60, required: true, placeholders: ['role', 'minutes'] }),
      share: f.text({ label: 'Share label', max: 20, required: true }),
      copy: f.text({ label: 'Copy-link label', max: 20, required: true }),
      copied: f.text({ label: 'Copied label', max: 20, required: true }),
      copyFailed: f.text({ label: 'Copy-failed label', max: 20, required: true }),
      contents: f.text({ label: 'Contents heading', max: 30, required: true }),
      relatedService: f.text({ label: 'Related-service label', max: 30, required: true }),
      viewService: f.text({ label: 'View-service link', max: 30, required: true }),
      writtenBy: f.text({ label: 'Written-by label', max: 30, required: true }),
      ctaEyebrow: f.text({ label: 'Closing panel eyebrow', hint: '{service} is the related service.', max: 60, required: true, placeholders: ['service'] }),
      ctaButton: f.text({ label: 'Closing panel button', max: 40, required: true, placeholders: ['service'] }),
      ctaCall: f.text({ label: 'Call link', max: 60, required: true }),
      moreTitle: f.text({ label: 'Keep reading heading', max: 40, required: true }),
      moreLink: f.text({ label: 'All-insights link', max: 30, required: true }),
    },
  },
} as const satisfies Record<string, TemplateDef>
