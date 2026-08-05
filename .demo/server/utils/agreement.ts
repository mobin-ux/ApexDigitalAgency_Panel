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
