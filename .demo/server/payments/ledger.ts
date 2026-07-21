import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { createLogger } from '../utils/logger'
import prisma from '../utils/prisma'

/**
 * Double-entry ledger (ADR-015 §6).
 *
 * The customer-facing `Transaction` feed answers "what happened to me".
 * This answers "does the money add up" — and it is the only thing that
 * makes reconciliation against a provider possible. Every economic event
 * posts a balanced journal: Σ debits == Σ credits, enforced before write.
 *
 * Sign convention (standard accounting, worth stating because it trips
 * people up): for ASSET accounts a DEBIT increases the balance. USER_WALLET
 * is a LIABILITY — we owe the customer their balance — so a customer top-up
 * CREDITS it. PROVIDER_CLEARING is an asset: cash sitting at Stripe.
 */

const log = createLogger('payments:ledger')

export type LedgerAccount =
  | 'USER_WALLET' // liability: customer funds we hold
  | 'PROVIDER_CLEARING' // asset: cash at the provider, pre-settlement
  | 'REVENUE' // income: what we earned
  | 'VAT' // liability: VAT owed to HMRC
  | 'CREDIT_RECEIVABLE' // asset: credit extended to customers
  | 'FEES' // expense: provider fees

export type Direction = 'DEBIT' | 'CREDIT'

export interface JournalLine {
  account: LedgerAccount
  direction: Direction
  /** Integer minor units, always positive — direction carries the sign. */
  amount: number
  userId?: string
  description?: string
}

export interface PostJournalInput {
  description: string
  lines: JournalLine[]
  paymentIntentId?: string
  currency?: string
  /** Supply when posting inside a wider transaction (the usual case). */
  tx?: Prisma.TransactionClient
}

export class UnbalancedJournalError extends Error {
  constructor(debits: number, credits: number) {
    super(`Unbalanced journal: debits ${debits} != credits ${credits}`)
    this.name = 'UnbalancedJournalError'
  }
}

/**
 * Post a balanced journal. Throws rather than writing a broken one — a
 * ledger that can be unbalanced is not a ledger.
 */
export async function postJournal(input: PostJournalInput): Promise<string> {
  const { lines, description, paymentIntentId, currency = 'GBP' } = input

  if (lines.length < 2) {
    throw new Error('A journal needs at least two lines')
  }

  let debits = 0
  let credits = 0
  for (const line of lines) {
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      throw new TypeError(`Ledger amounts must be positive integers (minor units), got ${line.amount}`)
    }
    if (line.direction === 'DEBIT') {
      debits += line.amount
    }
    else {
      credits += line.amount
    }
  }
  if (debits !== credits) {
    throw new UnbalancedJournalError(debits, credits)
  }

  const journalId = randomUUID()
  const client = input.tx ?? prisma

  await client.ledgerEntry.createMany({
    data: lines.map(line => ({
      journalId,
      account: line.account,
      direction: line.direction,
      amount: line.amount,
      currency,
      description: line.description ?? description,
      userId: line.userId,
      paymentIntentId,
    })),
  })

  log.debug('journal posted', { journalId, description, amount: debits, lines: lines.length })
  return journalId
}

// ---------------------------------------------------------------------------
// Standard journals — named so call sites read as accounting, not bookkeeping
// ---------------------------------------------------------------------------

/**
 * Customer tops up their wallet. Cash lands at the provider (asset up), and
 * we now owe the customer that balance (liability up). The provider fee is
 * an expense netted out of the same clearing account.
 */
export function walletTopUpLines(opts: { userId: string, amount: number, fee: number }): JournalLine[] {
  const lines: JournalLine[] = [
    { account: 'PROVIDER_CLEARING', direction: 'DEBIT', amount: opts.amount, userId: opts.userId },
    { account: 'USER_WALLET', direction: 'CREDIT', amount: opts.amount, userId: opts.userId },
  ]
  if (opts.fee > 0) {
    lines.push(
      { account: 'FEES', direction: 'DEBIT', amount: opts.fee },
      { account: 'PROVIDER_CLEARING', direction: 'CREDIT', amount: opts.fee },
    )
  }
  return lines
}

/**
 * An installment is collected from the wallet. Our liability to the customer
 * falls; the net becomes revenue and the VAT portion becomes a liability to
 * HMRC (which is why VAT must be a separate line, not folded into revenue).
 */
export function installmentChargeLines(opts: {
  userId: string
  amount: number
  vatAmount: number
}): JournalLine[] {
  const net = opts.amount - opts.vatAmount
  const lines: JournalLine[] = [
    { account: 'USER_WALLET', direction: 'DEBIT', amount: opts.amount, userId: opts.userId },
    { account: 'REVENUE', direction: 'CREDIT', amount: net },
  ]
  if (opts.vatAmount > 0) {
    lines.push({ account: 'VAT', direction: 'CREDIT', amount: opts.vatAmount })
  }
  else {
    // Keep two lines balanced when VAT is zero-rated.
    lines[1] = { account: 'REVENUE', direction: 'CREDIT', amount: opts.amount }
  }
  return lines
}

/** Money paid back out to a customer (withdrawal fulfilment). */
export function payoutLines(opts: { userId: string, amount: number }): JournalLine[] {
  return [
    { account: 'USER_WALLET', direction: 'DEBIT', amount: opts.amount, userId: opts.userId },
    { account: 'PROVIDER_CLEARING', direction: 'CREDIT', amount: opts.amount, userId: opts.userId },
  ]
}

/** A refund reverses revenue and VAT and restores the customer's balance. */
export function refundLines(opts: { userId: string, amount: number, vatAmount: number }): JournalLine[] {
  const net = opts.amount - opts.vatAmount
  const lines: JournalLine[] = [
    { account: 'REVENUE', direction: 'DEBIT', amount: opts.vatAmount > 0 ? net : opts.amount },
    { account: 'USER_WALLET', direction: 'CREDIT', amount: opts.amount, userId: opts.userId },
  ]
  if (opts.vatAmount > 0) {
    lines.splice(1, 0, { account: 'VAT', direction: 'DEBIT', amount: opts.vatAmount })
  }
  return lines
}

/** Credit drawn down by a customer becomes a receivable we expect back. */
export function creditDrawdownLines(opts: { userId: string, amount: number }): JournalLine[] {
  return [
    { account: 'CREDIT_RECEIVABLE', direction: 'DEBIT', amount: opts.amount, userId: opts.userId },
    { account: 'USER_WALLET', direction: 'CREDIT', amount: opts.amount, userId: opts.userId },
  ]
}

/** Credit repaid: the receivable clears against the customer's balance. */
export function creditRepaymentLines(opts: { userId: string, amount: number }): JournalLine[] {
  return [
    { account: 'USER_WALLET', direction: 'DEBIT', amount: opts.amount, userId: opts.userId },
    { account: 'CREDIT_RECEIVABLE', direction: 'CREDIT', amount: opts.amount, userId: opts.userId },
  ]
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface AccountBalance {
  account: string
  debits: number
  credits: number
  /** Signed balance in the account's natural direction. */
  balance: number
}

/**
 * Trial balance. `balance` uses each account's natural sign so the numbers
 * read the way an accountant expects; the whole set must sum to zero.
 */
export async function trialBalance(opts?: { from?: Date, to?: Date }): Promise<{
  accounts: AccountBalance[]
  balanced: boolean
}> {
  const where: Prisma.LedgerEntryWhereInput = {}
  if (opts?.from || opts?.to) {
    where.createdAt = { gte: opts?.from, lte: opts?.to }
  }

  const grouped = await prisma.ledgerEntry.groupBy({
    by: ['account', 'direction'],
    where,
    _sum: { amount: true },
  })

  const map = new Map<string, AccountBalance>()
  for (const row of grouped) {
    const entry = map.get(row.account) ?? { account: row.account, debits: 0, credits: 0, balance: 0 }
    if (row.direction === 'DEBIT') {
      entry.debits += row._sum.amount ?? 0
    }
    else {
      entry.credits += row._sum.amount ?? 0
    }
    map.set(row.account, entry)
  }

  // Assets and expenses are debit-natural; liabilities and income credit-natural.
  const DEBIT_NATURAL = new Set(['PROVIDER_CLEARING', 'CREDIT_RECEIVABLE', 'FEES'])
  const accounts = [...map.values()].map(entry => ({
    ...entry,
    balance: DEBIT_NATURAL.has(entry.account)
      ? entry.debits - entry.credits
      : entry.credits - entry.debits,
  }))

  const totalDebits = accounts.reduce((sum, a) => sum + a.debits, 0)
  const totalCredits = accounts.reduce((sum, a) => sum + a.credits, 0)

  return { accounts, balanced: totalDebits === totalCredits }
}

/** Current balance of one account, in minor units. */
export async function accountBalance(account: LedgerAccount): Promise<number> {
  const grouped = await prisma.ledgerEntry.groupBy({
    by: ['direction'],
    where: { account },
    _sum: { amount: true },
  })
  const debits = grouped.find(g => g.direction === 'DEBIT')?._sum.amount ?? 0
  const credits = grouped.find(g => g.direction === 'CREDIT')?._sum.amount ?? 0
  return debits - credits
}
