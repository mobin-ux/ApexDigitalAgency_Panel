/**
 * Copy shared by every case study page (`Case Study.dc.html`). What belongs to
 * one study — its story, figures and quote — is in `case-studies.ts`.
 */

/** The four chapters, in page order; the contents list and the headings' numbers follow it. */
export const storyChapters = [
  { id: 'problem', label: 'The problem' },
  { id: 'work', label: 'What we did' },
  { id: 'outcome', label: 'The outcome' },
  { id: 'services', label: 'Services used' },
] as const

export type StoryChapterId = typeof storyChapters[number]['id']

export const sideCta = {
  title: 'Want the same result?',
  button: 'Get the same for your business',
} as const

export const caseStudyCta = {
  /** Shown for a study without a written-up story. */
  fallback: {
    eyebrow: 'Run a similar business?',
    title: 'Get the same for your business',
    body: 'Tell us about your business and we will send back what we would change, a timeline and a monthly figure within one working day.',
  },
  /** Website studies add a launch line first, from the service's timeline: "Live in 4–6 weeks". */
  checks: ['VAT included', 'Free to cancel before kickoff'],
  button: 'Start your order',
  call: 'Or book a free 15-minute call',
} as const

export const similarProjects = {
  eyebrow: 'More work',
  title: 'Similar projects',
  link: 'See all work',
} as const
