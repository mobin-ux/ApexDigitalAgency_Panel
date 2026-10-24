import type { Catalog } from '../../shared/catalog'
import { resolveCatalog } from '../../shared/catalog'
import { getSetting } from './settings'

/**
 * The live v2 catalogue: Setting `catalog.v2` over the shared defaults.
 *
 * A new key rather than `catalog.services`, because that row may hold the
 * 2026-08 shape (four services priced as one project figure) and reading it as
 * v2 would price orders from the wrong model. `resolveCatalog` ignores anything
 * that is not v2-shaped.
 */
export async function getCatalog(): Promise<Catalog> {
  return resolveCatalog(await getSetting<unknown>('catalog.v2', null))
}
