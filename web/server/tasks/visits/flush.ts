import { flushVisits } from '../../utils/visits'

/** Hands the visit totals to the console; scheduled every minute (ADR-026, phase F). */
export default defineTask({
  meta: {
    name: 'visits:flush',
    description: 'Send the visit totals to the console',
  },
  async run() {
    return { result: await flushVisits() }
  },
})
