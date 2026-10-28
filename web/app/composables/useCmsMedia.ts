import type { Ref } from 'vue'

/**
 * Resolves a media reference to an image the site can show. The media
 * library (its files, sizes and the site's image pipeline) lands with the
 * media gate; until then no reference resolves, and the renderer shows
 * nothing in its place. Kept as a composable so the section components do
 * not change when it does.
 */
export function useCmsMedia(_src: Ref<string>): { src: string, width?: number, height?: number } | null {
  return null
}
