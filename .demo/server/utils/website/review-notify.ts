import type { WorkflowAction } from '../../../shared/cms'
import type { Db } from '../mail/outbox'
import { notify, notifyRoles } from '../notify'

/**
 * Who hears about a website workflow step (ADR-022): a submitted draft
 * reaches everyone who can publish; approve and reject go back to whoever
 * submitted it (else the last editor); a publish or schedule by someone
 * else tells the last editor their words are live. Nobody is told about
 * their own action. In the panel and by email, like every notification.
 */
export interface ReviewDoc {
  id: string
  kind: string
  key: string
  title: string
  submittedById: string | null
  draftUpdatedById: string | null
}

function editorLink(doc: ReviewDoc): string {
  return doc.kind === 'panel' ? '/admin/website/panel' : `/admin/website/pages/${doc.id}`
}

export async function notifyForTransition(action: WorkflowAction, doc: ReviewDoc, actor: { id: string }, db?: Db): Promise<number> {
  const link = editorLink(doc)
  const kind = 'cms-review' as const
  switch (action) {
    case 'submit': {
      const result = await notifyRoles('website.publish', {
        title: `"${doc.title}" is waiting for review`,
        message: `A draft of "${doc.title}" (${doc.key}) was submitted for review and needs a publisher to approve, send it back or publish it.`,
        type: 'INFO',
        link,
        kind,
        excludeUserId: actor.id,
      }, db)
      return result.notified
    }
    case 'approve':
    case 'reject': {
      const to = doc.submittedById ?? doc.draftUpdatedById
      if (!to || to === actor.id) {
        return 0
      }
      const result = await notify({
        userIds: [to],
        title: action === 'approve' ? `"${doc.title}" was approved` : `"${doc.title}" was sent back`,
        message: action === 'approve'
          ? `Your draft of "${doc.title}" (${doc.key}) was approved and can be published.`
          : `Your draft of "${doc.title}" (${doc.key}) was sent back for changes. Open it to edit and submit again.`,
        type: action === 'approve' ? 'SUCCESS' : 'WARNING',
        link,
        kind,
      }, db)
      return result.notified
    }
    case 'publish':
    case 'schedule': {
      const to = doc.draftUpdatedById
      if (!to || to === actor.id) {
        return 0
      }
      const result = await notify({
        userIds: [to],
        title: action === 'publish' ? `"${doc.title}" is live` : `"${doc.title}" is scheduled`,
        message: action === 'publish'
          ? `Your draft of "${doc.title}" (${doc.key}) was published.`
          : `Your draft of "${doc.title}" (${doc.key}) was scheduled to publish.`,
        type: 'SUCCESS',
        link,
        kind,
      }, db)
      return result.notified
    }
    default:
      return 0
  }
}
