/**
 * Copy shared by every article page (`Article.dc.html`). What belongs to one
 * article — its sections, figures, author and closing panel — is in `articles.ts`.
 */

export const articleChrome = {
  updated: 'Updated',
  byline: (role: string, minutes: number) => `${role}, Apex · ${minutes} min read`,
  share: {
    label: 'Share',
    linkedin: 'Share on LinkedIn',
    x: 'Share on X',
    copy: 'Copy link',
    copied: 'Copied',
    failed: 'Copy failed',
  },
  contents: 'In this guide',
  sideService: { label: 'Related service', link: 'View service' },
  writtenBy: 'Written by',
} as const

export const articleCta = {
  eyebrow: (service: string) => `Related service · ${service}`,
  button: (service: string) => `View ${service}`,
  call: 'Or book a free 15-minute call',
} as const

export const keepReading = {
  title: 'Keep reading',
  link: 'All insights',
} as const
