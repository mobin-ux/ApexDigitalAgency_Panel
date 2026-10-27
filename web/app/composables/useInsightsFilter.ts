import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { Article } from '~/data/articles'
import type { ServiceSlug } from '~/data/routes'
import { articles, articleTopic, articleTopics, topicLabel } from '~/data/articles'

/**
 * The search box and topic chips on /insights. The page creates the state with
 * `provideInsightsFilter()`; the hero's search and the article list read it
 * with `useInsightsFilter()`.
 *
 * Works like the Our work filters: the prerendered HTML lists every article,
 * the search and topic are mirrored in `?q=` and `?topic=` so a view can be
 * shared, and both are read after mount, because a prerendered page is one
 * file for every query string.
 */
export interface InsightsFilter {
  query: Ref<string>
  topic: Ref<ServiceSlug | null>
  /** The articles shown: written ones first, newest first, then the rest in catalogue order. */
  visible: ComputedRef<Article[]>
  /** Within the current search, how many articles each topic chip would show. */
  chips: ComputedRef<{ id: ServiceSlug | null, label: string, count: number }[]>
  filtered: ComputedRef<boolean>
  resultLabel: ComputedRef<string>
  /** Cards animate in only after a change, so the first paint never waits on an animation. */
  animate: Ref<boolean>
  pickTopic: (id: ServiceSlug | null) => void
  ask: (query: string) => void
  clear: () => void
}

const key: InjectionKey<InsightsFilter> = Symbol('insights-filter')

const ordered = [
  ...articles
    .filter(article => article.body)
    .sort((a, b) => (b.updated ?? b.published ?? '').localeCompare(a.updated ?? a.published ?? '')),
  ...articles.filter(article => !article.body),
]

function isTopic(value: unknown): value is ServiceSlug {
  return articleTopics.some(topic => topic.service === value)
}

function plural(count: number): string {
  return `${count} ${count === 1 ? 'article' : 'articles'}`
}

/** Every word of the search must appear in the title, summary, topic or format. */
function matches(article: Article, words: string[]): boolean {
  const text = [article.title, article.excerpt, articleTopic(article), article.format].join(' ').toLowerCase()
  return words.every(word => text.includes(word))
}

export function provideInsightsFilter(): InsightsFilter {
  const route = useRoute()
  const router = useRouter()

  const query = ref('')
  const topic = ref<ServiceSlug | null>(null)
  const animate = ref(false)

  onMounted(() => {
    const { q, topic: fromTopic } = route.query
    if (typeof q === 'string') {
      query.value = q.slice(0, 120)
    }
    if (isTopic(fromTopic)) {
      topic.value = fromTopic
    }
  })

  watch([query, topic], ([queryValue, topicValue]) => {
    const next = { ...route.query }
    delete next.q
    delete next.topic
    if (queryValue.trim()) {
      next.q = queryValue.trim()
    }
    if (topicValue) {
      next.topic = topicValue
    }
    router.replace({ query: next })
  })

  const words = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))
  const searched = computed(() => ordered.filter(article => matches(article, words.value)))
  const visible = computed(() => searched.value.filter(article => !topic.value || article.service === topic.value))

  const chips = computed(() => [
    { id: null, label: 'All topics', count: searched.value.length },
    ...articleTopics.map(item => ({
      id: item.service,
      label: item.label,
      count: searched.value.filter(article => article.service === item.service).length,
    })),
  ])

  const filtered = computed(() => Boolean(words.value.length || topic.value))

  const resultLabel = computed(() => {
    const count = plural(visible.value.length)
    if (!filtered.value) {
      const written = visible.value.filter(article => article.body).length
      return `${count}: ${written} published, ${visible.value.length - written} coming soon`
    }
    const label = topic.value && topicLabel(topic.value)
    // "on SEO", "on paid ads": acronyms keep their capitals.
    const onTopic = label ? ` on ${label === label.toUpperCase() ? label : label.toLowerCase()}` : ''
    return words.value.length ? `${count} matching “${query.value.trim()}”${onTopic}` : `${count}${onTopic}`
  })

  const state: InsightsFilter = {
    query,
    topic,
    visible,
    chips,
    filtered,
    resultLabel,
    animate,
    pickTopic(id) {
      animate.value = true
      topic.value = topic.value === id ? null : id
    },
    ask(value) {
      animate.value = true
      query.value = value
      topic.value = null
    },
    clear() {
      animate.value = true
      query.value = ''
      topic.value = null
    },
  }
  provide(key, state)
  return state
}

export function useInsightsFilter(): InsightsFilter {
  const state = inject(key)
  if (!state) {
    throw createError({ statusMessage: 'useInsightsFilter() needs provideInsightsFilter() in the page' })
  }
  return state
}
