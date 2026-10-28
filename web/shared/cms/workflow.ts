/**
 * The publishing lifecycle, as a pure state machine.
 *
 * It lives in the shared contract rather than in the panel's server so the
 * admin screens, the server and the tests all ask the same function which
 * buttons a document has and what each one does. The function never touches
 * a database: it answers with a patch and an *effect* the server carries
 * out inside its transaction (point the published pointer at the latest
 * draft revision, snapshot the draft for a schedule, and so on).
 *
 * Two independent axes: `status` is what the website serves (DRAFT means
 * nothing of this document is live; PUBLISHED means a revision is; ARCHIVED
 * means it was taken down and parked) and `review` is where the working
 * draft stands (NONE, IN_REVIEW, APPROVED). A published page with new draft
 * changes is therefore `PUBLISHED` + a review state, which is what the
 * display status folds into one label.
 */

export const DOCUMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type DocumentStatus = typeof DOCUMENT_STATUSES[number]

export const REVIEW_STATES = ['NONE', 'IN_REVIEW', 'APPROVED'] as const
export type ReviewState = typeof REVIEW_STATES[number]

export interface WorkflowDoc {
  status: DocumentStatus
  review: ReviewState
  publishedRevisionId: string | null
  scheduledRevisionId: string | null
  scheduledFor: Date | string | null
  /** True when the working draft differs from the published revision. */
  draftChanged: boolean
  /** True once any revision has ever been published, even if it was unpublished since. */
  everPublished?: boolean
  lastPublishError?: string | null
}

export const DISPLAY_STATUSES = ['draft', 'in_review', 'approved', 'scheduled', 'published', 'published_changes', 'archived'] as const
export type DisplayStatus = typeof DISPLAY_STATUSES[number]

export const DISPLAY_STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  published_changes: 'Published, draft changes',
  archived: 'Archived',
}

/** One label per document, folding the two axes into what a person needs to know. */
export function displayStatus(doc: WorkflowDoc): DisplayStatus {
  if (doc.status === 'ARCHIVED') {
    return 'archived'
  }
  if (doc.scheduledRevisionId) {
    return 'scheduled'
  }
  if (doc.status === 'PUBLISHED') {
    return doc.draftChanged ? 'published_changes' : 'published'
  }
  if (doc.review === 'IN_REVIEW') {
    return 'in_review'
  }
  if (doc.review === 'APPROVED') {
    return 'approved'
  }
  return 'draft'
}

export const WORKFLOW_ACTIONS = ['submit', 'approve', 'reject', 'publish', 'schedule', 'unschedule', 'unpublish', 'archive', 'restore', 'delete'] as const
export type WorkflowAction = typeof WORKFLOW_ACTIONS[number]

/** Which website permission each action needs; the panel maps these onto its matrix. */
export const ACTION_PERMISSION: Record<WorkflowAction, 'website.edit' | 'website.publish'> = {
  submit: 'website.edit',
  approve: 'website.publish',
  reject: 'website.publish',
  publish: 'website.publish',
  schedule: 'website.publish',
  unschedule: 'website.publish',
  unpublish: 'website.publish',
  archive: 'website.publish',
  restore: 'website.publish',
  delete: 'website.publish',
}

export const ACTION_LABEL: Record<WorkflowAction, string> = {
  submit: 'Submit for review',
  approve: 'Approve',
  reject: 'Send back',
  publish: 'Publish now',
  schedule: 'Schedule',
  unschedule: 'Cancel schedule',
  unpublish: 'Unpublish',
  archive: 'Archive',
  restore: 'Restore',
  delete: 'Delete draft',
}

/** What the server must do besides applying the patch. */
export type WorkflowEffect
  = | 'none'
    | 'publish-draft'
    | 'schedule-draft'
    | 'unschedule'
    | 'unpublish'
    | 'archive'
    | 'delete'

export interface WorkflowPatch {
  status?: DocumentStatus
  review?: ReviewState
  scheduledFor?: Date | null
}

export type WorkflowResult
  = | { ok: true, patch: WorkflowPatch, effect: WorkflowEffect, auditAction: string }
    | { ok: false, reason: string }

export interface TransitionInput {
  scheduledFor?: Date | string | null
  now?: Date
}

function refuse(reason: string): WorkflowResult {
  return { ok: false, reason }
}

/**
 * Apply one action to a document. Every refusal carries the sentence the
 * screen shows, so a crafted request and a button get the same answer.
 */
export function transition(doc: WorkflowDoc, action: WorkflowAction, input: TransitionInput = {}): WorkflowResult {
  const archived = doc.status === 'ARCHIVED'
  const audit = `admin.website.document.${action}`

  switch (action) {
    case 'submit':
      if (archived) {
        return refuse('Restore the document before submitting it.')
      }
      if (doc.review === 'IN_REVIEW') {
        return refuse('This draft is already in review.')
      }
      if (doc.status === 'PUBLISHED' && !doc.draftChanged) {
        return refuse('There are no draft changes to review.')
      }
      return { ok: true, patch: { review: 'IN_REVIEW' }, effect: 'none', auditAction: audit }

    case 'approve':
      if (doc.review !== 'IN_REVIEW') {
        return refuse('Only a draft in review can be approved.')
      }
      return { ok: true, patch: { review: 'APPROVED' }, effect: 'none', auditAction: audit }

    case 'reject':
      if (doc.review === 'NONE') {
        return refuse('This draft is not in review.')
      }
      return { ok: true, patch: { review: 'NONE' }, effect: 'none', auditAction: audit }

    case 'publish':
      if (archived) {
        return refuse('Restore the document before publishing it.')
      }
      if (doc.status === 'PUBLISHED' && !doc.draftChanged && !doc.scheduledRevisionId) {
        return refuse('The latest draft is already published.')
      }
      return { ok: true, patch: { status: 'PUBLISHED', review: 'NONE', scheduledFor: null }, effect: 'publish-draft', auditAction: audit }

    case 'schedule': {
      if (archived) {
        return refuse('Restore the document before scheduling it.')
      }
      const when = input.scheduledFor ? new Date(input.scheduledFor) : null
      if (!when || Number.isNaN(when.getTime())) {
        return refuse('Choose a date and time to publish at.')
      }
      const now = input.now ?? new Date()
      if (when.getTime() <= now.getTime() + 60_000) {
        return refuse('The publish time must be at least a minute from now. Use Publish now for immediately.')
      }
      if (doc.status === 'PUBLISHED' && !doc.draftChanged) {
        return refuse('There are no draft changes to schedule.')
      }
      return { ok: true, patch: { scheduledFor: when }, effect: 'schedule-draft', auditAction: audit }
    }

    case 'unschedule':
      if (!doc.scheduledRevisionId) {
        return refuse('Nothing is scheduled for this document.')
      }
      return { ok: true, patch: { scheduledFor: null }, effect: 'unschedule', auditAction: audit }

    case 'unpublish':
      if (doc.status !== 'PUBLISHED') {
        return refuse('This document is not published.')
      }
      return { ok: true, patch: { status: 'DRAFT', review: 'NONE', scheduledFor: null }, effect: 'unpublish', auditAction: audit }

    case 'archive':
      if (archived) {
        return refuse('This document is already archived.')
      }
      return { ok: true, patch: { status: 'ARCHIVED', review: 'NONE', scheduledFor: null }, effect: 'archive', auditAction: audit }

    case 'restore':
      if (!archived) {
        return refuse('Only an archived document can be restored.')
      }
      return { ok: true, patch: { status: 'DRAFT', review: 'NONE' }, effect: 'none', auditAction: audit }

    case 'delete':
      if (doc.publishedRevisionId || doc.everPublished || doc.status !== 'DRAFT') {
        return refuse('Only a draft that was never published can be deleted. Archive it instead.')
      }
      if (doc.scheduledRevisionId) {
        return refuse('Cancel the schedule before deleting this draft.')
      }
      return { ok: true, patch: {}, effect: 'delete', auditAction: audit }
  }
}

/** The actions that would succeed right now, in button order. */
export function availableActions(doc: WorkflowDoc, now = new Date()): WorkflowAction[] {
  const probe = new Date(now.getTime() + 3_600_000)
  return WORKFLOW_ACTIONS.filter(action => transition(doc, action, { scheduledFor: probe, now }).ok)
}
