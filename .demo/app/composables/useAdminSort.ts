/**
 * Server-side sort state for one admin list (ADR-025): what `AdminSortHeader`
 * shows and what goes into the list's query as `?sort=&dir=`. Changing the
 * order goes back to page 1, since page 3 of a different order is a different
 * set of rows.
 */
export function useAdminSort(defaults: { sort: string, dir: 'asc' | 'desc' }, page?: Ref<number>) {
  const state = reactive({ ...defaults })
  function setSort(column: string, dir: 'asc' | 'desc') {
    state.sort = column
    state.dir = dir
    if (page) {
      page.value = 1
    }
  }
  /** The query fragment; the default order sends nothing, so URLs stay short. */
  const sortQuery = computed(() => (state.sort === defaults.sort && state.dir === defaults.dir ? {} : { sort: state.sort, dir: state.dir }))
  return { state, setSort, sortQuery }
}
