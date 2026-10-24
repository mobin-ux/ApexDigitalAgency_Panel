import { createHash } from 'node:crypto'

/**
 * Canonical service + financing agreement builder.
 *
 * One deterministic function renders the exact legal document a customer signs
 * in the New Order wizard, so the text shown to the customer, the text stored
 * as the contract record, and the hashed evidence are guaranteed identical.
 *
 * UK legal context (why this exists):
 *  - Electronic Communications Act 2000 s.7 + eIDAS make an electronic
 *    signature admissible; enforceability turns on *evidence* of who signed,
 *    what they signed, and their intent to be bound.
 *  - We therefore version the clause set (`AGREEMENT_VERSION`), snapshot the
 *    full text into the Contract row, and store a SHA-256 of that text
 *    (`hashAgreement`) so any later alteration is detectable (tamper-evidence).
 *  - The Consumer Contracts (Information, Cancellation and Additional Charges)
 *    Regulations 2013 require pre-contract information and a cancellation
 *    statement in a durable medium — both are baked into the clauses below.
 *
 * Bump AGREEMENT_VERSION whenever the wording changes so historic contracts
 * stay pinned to the exact terms their signatory agreed to.
 */
export const AGREEMENT_VERSION = 'apex-msa-2026-08'

export interface AgreementInput {
  agencyName: string
  vatRate: number
  reference: string
  serviceName: string
  planName: string
  amount: number
  termMonths: number
  interestRate: number // monthly rate (0 for 12-mo, 0.01 for 24-mo)
  monthlyAmount: number
  totalRepayable: number
  firstDueDays: number
  signerName: string
  signerContact: string // email or phone on file
  signedAt: Date
}

function gbp(n: number): string {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Build the full, human-readable agreement as plain text. Deterministic given
 * the same input (used both for display-safe rendering and for hashing).
 */
export function buildAgreementText(input: AgreementInput): string {
  const {
    agencyName,
    reference,
    serviceName,
    planName,
    amount,
    termMonths,
    interestRate,
    monthlyAmount,
    totalRepayable,
    firstDueDays,
    signerName,
    signerContact,
    signedAt,
  } = input

  const interestLine = interestRate > 0
    ? `${(interestRate * 100).toFixed(0)}% per month on the reducing balance (${gbp(totalRepayable - amount)} total interest)`
    : '0% — interest-free'

  const firstDue = new Date(signedAt.getTime() + firstDueDays * 24 * 60 * 60 * 1000)
  const signedStamp = `${signedAt.toISOString()} (UTC)`

  return [
    `SERVICE & FINANCING AGREEMENT`,
    `Reference: ${reference}`,
    `Version: ${AGREEMENT_VERSION}`,
    ``,
    `This agreement is made between ${agencyName} ("the Agency", a United Kingdom`,
    `digital agency) and the client identified below ("the Client") for the supply`,
    `of professional services financed by the Agency's instalment facility.`,
    ``,
    `PARTIES`,
    `  Client (signatory): ${signerName}`,
    `  Client contact: ${signerContact}`,
    `  Agency: ${agencyName}`,
    ``,
    `1. SERVICES`,
    `  The Agency will provide "${serviceName}" services under the "${planName}" plan,`,
    `  delivering the features and deliverables set out in that plan and in the`,
    `  Client's project brief captured at the time of order. Work begins`,
    `  immediately upon signature; no deposit is payable.`,
    ``,
    `2. CHARGES & PAYMENT SCHEDULE`,
    `  Total project value: ${gbp(amount)}.`,
    `  Repayment term: ${termMonths} monthly instalments of ${gbp(monthlyAmount)}.`,
    `  Interest: ${interestLine}.`,
    `  Total repayable: ${gbp(totalRepayable)}.`,
    `  The first instalment is collected ${firstDueDays} days after signature`,
    `  (on or around ${firstDue.toISOString().slice(0, 10)}); subsequent instalments`,
    `  monthly thereafter. There are no early-repayment fees.`,
    ``,
    `3. CREDIT FACILITY`,
    `  This project draws on the Client's Apex credit facility. The financed`,
    `  amount reduces the Client's available credit until repaid in full.`,
    ``,
    `4. REVISIONS & SUPPORT`,
    `  Revisions and support are provided as specified in the selected plan.`,
    `  Additional scope beyond the plan is quoted and agreed separately.`,
    ``,
    `5. CANCELLATION & CONSUMER RIGHTS`,
    `  The Client may cancel at no cost before work begins. By requesting that`,
    `  work start immediately, a consumer Client acknowledges that where the`,
    `  service is fully performed the statutory 14-day right to cancel under the`,
    `  Consumer Contracts Regulations 2013 is lost, and that for part-performed`,
    `  work a proportionate charge for completed milestones is payable.`,
    ``,
    `6. INTELLECTUAL PROPERTY`,
    `  On full payment of all sums due, ownership of the final delivered work`,
    `  transfers to the Client. The Agency retains ownership of pre-existing`,
    `  tools, libraries and know-how used to produce it.`,
    ``,
    `7. GOVERNING LAW`,
    `  This agreement is governed by the laws of England and Wales and is subject`,
    `  to the exclusive jurisdiction of the courts of England and Wales.`,
    ``,
    `8. ELECTRONIC SIGNATURE & CONSENT`,
    `  The Client consents to entering into this agreement by electronic means`,
    `  and agrees that their electronic signature is legally binding and has the`,
    `  same effect as a handwritten signature (Electronic Communications Act 2000).`,
    `  By signing, the Client confirms they have read and understood this`,
    `  agreement and intend to be legally bound by it.`,
    ``,
    `SIGNED electronically by ${signerName} on ${signedStamp}.`,
  ].join('\n')
}

/** SHA-256 hex digest of the agreement text — tamper-evidence for the record. */
export function hashAgreement(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Panel v2 agreement (ADR-019): the website's payment schedules — a deposit
 * and monthly payments, a retainer with a minimum term, or fixed-price
 * discovery. Kept beside the 2026-08 text rather than replacing it, because a
 * contract signed under that version must stay reproducible word for word.
 */
export const AGREEMENT_VERSION_V2 = 'apex-msa-2026-10'

export interface AgreementInputV2 {
  agencyName: string
  reference: string
  serviceName: string
  planName: string
  kind: 'fixed' | 'retainer' | 'scope'
  payInFull: boolean
  kickoff: number
  deposit: number
  setup: number
  monthly: number
  payments: number
  minimumMonths: number
  total: number
  signerName: string
  signerContact: string
  signedAt: Date
}

export function buildAgreementTextV2(input: AgreementInputV2): string {
  const { agencyName, reference, serviceName, planName, kind, payInFull, kickoff, deposit, setup, monthly, payments, minimumMonths, total, signerName, signerContact, signedAt } = input

  let schedule: string[]
  if (kind === 'fixed' && payInFull) {
    schedule = [
      `  One payment of ${gbp(total)}, collected after the kickoff call.`,
      `  Nothing further is payable for the plan.`,
    ]
  }
  else if (kind === 'fixed') {
    schedule = [
      `  A deposit of ${gbp(deposit)}, collected after the kickoff call, then`,
      `  ${payments} monthly payments of ${gbp(monthly)}, the first on the 1st of a`,
      `  month at least fourteen days after the deposit.`,
      `  Total, all in: ${gbp(total)}. No interest is charged.`,
    ]
  }
  else if (kind === 'retainer') {
    schedule = [
      `  ${setup > 0 ? `A set-up fee of ${gbp(setup)} and the` : 'The'} first month (${gbp(monthly)}),`,
      `  collected after the kickoff call, then ${gbp(monthly)} a month.`,
      `  Minimum term: ${minimumMonths} months (${gbp(total)} in total). After that the`,
      `  retainer continues monthly until either party gives 30 days' notice.`,
    ]
  }
  else if (kickoff > 0) {
    schedule = [
      `  A fixed fee of ${gbp(kickoff)} for discovery, collected when discovery`,
      `  starts. Any build is quoted separately and agreed in writing.`,
    ]
  }
  else {
    schedule = [
      `  Nothing is payable. The scoping call is free and commits neither party`,
      `  to further work.`,
    ]
  }

  return [
    `SERVICE AGREEMENT`,
    `Reference: ${reference}`,
    `Version: ${AGREEMENT_VERSION_V2}`,
    ``,
    `This agreement is made between ${agencyName} ("the Agency", a United Kingdom`,
    `digital agency) and the client identified below ("the Client").`,
    ``,
    `PARTIES`,
    `  Client (signatory): ${signerName}`,
    `  Client contact: ${signerContact}`,
    `  Agency: ${agencyName}`,
    ``,
    `1. SERVICES`,
    `  The Agency will provide "${serviceName}" services under the "${planName}"`,
    `  plan, as described in that plan and in the Client's brief captured at the`,
    `  time of order. Work starts after a kickoff call to agree scope and dates.`,
    ``,
    `2. CHARGES AND PAYMENT SCHEDULE`,
    ...schedule,
    `  Figures include VAT. Payments are taken from the Client's Apex wallet;`,
    `  the Client keeps it topped up by card or bank transfer. This is a payment`,
    `  schedule for the Agency's own services, not a credit agreement.`,
    ``,
    `3. CANCELLATION AND CONSUMER RIGHTS`,
    `  The Client may cancel at no cost before the kickoff call. A consumer`,
    `  Client who asks for work to start within the statutory 14-day period`,
    `  acknowledges that a proportionate charge for completed work is payable.`,
    ``,
    `4. INTELLECTUAL PROPERTY`,
    `  The Client owns the final delivered work. The Agency retains its`,
    `  pre-existing tools, libraries and know-how used to produce it.`,
    ``,
    `5. GOVERNING LAW`,
    `  This agreement is governed by the laws of England and Wales and is subject`,
    `  to the exclusive jurisdiction of the courts of England and Wales.`,
    ``,
    `6. ELECTRONIC SIGNATURE AND CONSENT`,
    `  The Client consents to entering into this agreement by electronic means`,
    `  and agrees that their electronic signature is legally binding and has the`,
    `  same effect as a handwritten signature (Electronic Communications Act 2000).`,
    ``,
    `SIGNED electronically by ${signerName} on ${signedAt.toISOString()} (UTC).`,
  ].join('\n')
}
