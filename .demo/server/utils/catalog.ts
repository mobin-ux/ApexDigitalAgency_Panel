/**
 * Canonical defaults for customer-facing configuration. Each block is
 * the fallback for a Setting key (see /api/config) — the admin panel
 * can override any of them by writing the corresponding Setting row,
 * and features read the merged result. Single source of truth: the
 * pages no longer hardcode any of this.
 */

// The service and plan catalogue moved to `shared/catalog.ts` (Panel v2,
// ADR-019), read through `utils/catalog-v2.ts` from Setting `catalog.v2`.

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
