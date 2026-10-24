/**
 * Customer-facing references (Panel v2): `APX-1A2B3C` for an order and
 * `T-1A2B3C` for a support request. Derived from the record's UUID, so the
 * same order reads the same everywhere — dashboard, My orders, Wallet, Support
 * and the admin panel — without a stored counter that could be duplicated.
 */
function hex(id: string, n: number) {
  return String(id).replace(/-/g, '').slice(0, n).toUpperCase()
}

export function orderRef(id: string): string {
  return `APX-${hex(id, 6)}`
}

export function ticketRef(id: string): string {
  return `T-${hex(id, 6)}`
}
