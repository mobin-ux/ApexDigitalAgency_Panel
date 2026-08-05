import type { Prisma } from '@prisma/client'

/**
 * Contract reference: CTR-YYYY-NNNN, sequential per calendar year. Generated
 * inside the order transaction so the number and the row commit together.
 * (`tx` is the transactional Prisma client.)
 */
export async function nextContractReference(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `CTR-${year}-`
  const count = await tx.contract.count({ where: { reference: { startsWith: prefix } } })
  return `${prefix}${String(count + 1).padStart(4, '0')}`
}
