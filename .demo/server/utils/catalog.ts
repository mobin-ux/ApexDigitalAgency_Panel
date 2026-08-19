/**
 * Canonical defaults for customer-facing configuration. Each block is
 * the fallback for a Setting key (see /api/config) — the admin panel
 * can override any of them by writing the corresponding Setting row,
 * and features read the merged result. Single source of truth: the
 * pages no longer hardcode any of this.
 */

export interface CatalogPlan {
  id: string
  name: string
  base: number
  tier: 0 | 1 | 2
  popular?: boolean
  desc: string
  features: string[]
}

export interface CatalogService {
  id: string
  name: string
  desc: string
  icon: string
  tone: string
}

/** Setting key: `catalog.services` */
export const DEFAULT_CATALOG: { services: CatalogService[], plans: Record<string, CatalogPlan[]> } = {
  services: [
    { id: 'web', name: 'Web development', desc: 'WordPress, React & custom code', icon: 'lucide:code-2', tone: 'text-primary-400 bg-primary-500/14' },
    { id: 'mkt', name: 'Marketing & ads', desc: 'SEO, PPC & growth', icon: 'lucide:megaphone', tone: 'text-[#EC6453] bg-[#EC6453]/14' },
    { id: 'uiux', name: 'UI/UX design', desc: 'Product design & prototyping', icon: 'lucide:pen-tool', tone: 'text-primary-400 bg-primary-500/14' },
    { id: 'brand', name: 'Branding', desc: 'Identity, logo & strategy', icon: 'lucide:target', tone: 'text-[#F2C14E] bg-[#D9A521]/14' },
  ],
  plans: {
    web: [
      { id: 'web-launch', name: 'Launch', base: 2400, tier: 0, desc: 'A polished one-page site to get you online fast.', features: ['Up to 3 sections', 'Mobile-first build', 'Basic SEO setup', '30 days of support'] },
      { id: 'web-growth', name: 'Growth', base: 4800, tier: 1, popular: true, desc: 'A multi-page custom site built to convert visitors.', features: ['Up to 8 pages', 'Custom UI/UX design', 'Lead-capture forms', 'SEO + analytics', '90 days of support'] },
      { id: 'web-scale', name: 'Scale', base: 9600, tier: 2, desc: 'A high-performance React/Next.js platform with integrations.', features: ['Unlimited pages', 'React / Next.js build', 'API & CRM integrations', 'Priority delivery', '12 months of support'] },
    ],
    mkt: [
      { id: 'mkt-spark', name: 'Spark', base: 1800, tier: 0, desc: 'Kickstart demand with a focused single-channel campaign.', features: ['1 ad channel', 'Audience research', '5 ad creatives', 'Monthly report'] },
      { id: 'mkt-momentum', name: 'Momentum', base: 3600, tier: 1, popular: true, desc: 'A multi-channel growth engine tuned for leads.', features: ['3 ad channels', 'Landing page', 'A/B testing', 'Weekly optimisation', 'Conversion tracking'] },
      { id: 'mkt-dominate', name: 'Dominate', base: 7200, tier: 2, desc: 'Full-funnel growth with a dedicated strategist.', features: ['Unlimited channels', 'Dedicated strategist', 'Creative studio', 'Retargeting', 'Priority support'] },
    ],
    uiux: [
      { id: 'ux-essential', name: 'Essential', base: 2400, tier: 0, desc: 'Clean, usable screens for your core flow.', features: ['Up to 6 screens', 'Wireframes', '1 revision round', 'Figma handoff'] },
      { id: 'ux-product', name: 'Product', base: 4800, tier: 1, popular: true, desc: 'End-to-end product design with a clickable prototype.', features: ['Up to 20 screens', 'Interactive prototype', 'UX research', 'Design QA', 'Unlimited revisions'] },
      { id: 'ux-system', name: 'Design system', base: 8400, tier: 2, desc: 'A scalable design system your team can build on.', features: ['Design system', 'Component library', 'Accessibility audit', 'Dev handoff', 'Ongoing support'] },
    ],
    brand: [
      { id: 'br-identity', name: 'Identity', base: 1800, tier: 0, desc: 'The essentials to launch a memorable brand.', features: ['Logo suite', 'Colour & type', 'Brand guidelines (lite)', '3 concepts'] },
      { id: 'br-studio', name: 'Studio', base: 3600, tier: 1, popular: true, desc: 'A complete brand kit across every touchpoint.', features: ['Full logo system', 'Brand guidelines', 'Business cards', 'Social-media kit', '2 revision rounds'] },
      { id: 'br-signature', name: 'Signature', base: 7200, tier: 2, desc: 'Premium, end-to-end brand strategy & identity.', features: ['Brand strategy', 'Full identity system', 'Messaging & voice', 'Launch assets', 'Priority support'] },
    ],
  },
}

/** Setting key: `catalog.from-prices` — "from £X/mo" figures on the home page. */
export const DEFAULT_FROM_PRICES: Record<string, number> = {
  marketing: 290,
  development: 420,
  seo: 190,
  branding: 250,
}

/** Setting key: `finance.bank-details` — the agency's receiving account. */
export const DEFAULT_BANK_DETAILS = [
  { key: 'name', label: 'Account name', value: 'Apex Digital Agency Ltd' },
  { key: 'sort', label: 'Sort code', value: '04-00-04' },
  { key: 'acct', label: 'Account number', value: '2847 1196' },
  { key: 'iban', label: 'IBAN', value: 'GB29 APEX 0400 0428 4711 96' },
]

/** Setting key: `support.faq` */
export const DEFAULT_FAQ = [
  { cat: 'billing', q: 'How do installments and monthly payments work?', a: 'Every project can be split into equal monthly installments — 3, 6 or 12 months depending on the service. Payments are taken automatically from your wallet first, then your default card. You can see the full schedule and pay early any time from the Wallet & credit page.' },
  // Describes what the product actually does: there is no attachment upload
  // yet, so this must not tell customers to attach files to a conversation.
  { cat: 'technical', q: 'How do I share access or files with my project team?', a: 'Ask in a Technical request and we\'ll reply with a secure upload link — screenshots, briefs and PDFs all welcome. For site access, share credentials the same way; we\'ll confirm receipt and never store passwords in plain text.' },
  { cat: 'project', q: 'Where can I track the progress of my active projects?', a: 'Your Dashboard shows every active project with a live progress bar and next milestone. For project-specific questions, open a request and tag the related project so the right specialist picks it up.' },
  { cat: 'presales', q: 'Can I get a quote before committing to a project?', a: 'Absolutely. Start a Pre-sales request describing what you have in mind and our team will send a detailed quote — usually within one working day — including scope, timeline and installment options.' },
  { cat: 'aftersales', q: 'What happens after a project is delivered?', a: 'You get a full handover pack with all source files, plus 30 days of complimentary support for tweaks and questions. After that, ongoing care plans are available — just ask via an After-sales request.' },
  { cat: 'general', q: 'What are your support hours and response times?', a: 'Our team is online Monday–Friday, 9am–6pm GMT, with a target first response of 15 minutes for standard requests and under 5 minutes for urgent ones. Outside hours, urgent tickets are monitored on-call.' },
]
