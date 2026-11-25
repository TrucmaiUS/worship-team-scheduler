import { z } from 'zod';
import { ArtifactStore, recordId } from './artifacts';
import type { LeakageAuditResult } from './types';

const ReviewDecisionSchema = z.object({
  reviewId: z.string().min(1),
  queryId: z.string().min(1),
  reviewerId: z.string().min(1),
  reviewerRole: z.enum(['first_reviewer', 'second_reviewer', 'adjudicator']),
  decision: z.enum(['passed', 'discarded']),
  rationale: z.string().min(10),
  decidedAtUtc: z.string().datetime(),
  policyVersion: z.string().min(1),
}).strict();

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export interface ReviewResolution {
  reviewId: string;
  queryId: string;
  policyVersion: string;
  status: 'pending_second_review' | 'pending_adjudication' | 'resolved';
  finalDecision: 'passed' | 'discarded' | null;
  reviewerIds: string[];
}

export function resolveLeakageReview(decisionsInput: readonly unknown[]): ReviewResolution {
  const decisions = decisionsInput.map(input => ReviewDecisionSchema.parse(input));
  if (decisions.length === 0) throw new Error('No review decisions to resolve.');
  const first = decisions[0];
  if (decisions.some(item => item.reviewId !== first.reviewId ||
      item.queryId !== first.queryId || item.policyVersion !== first.policyVersion)) {
    throw new Error('Review decisions refer to different cases or policies.');
  }
  if (new Set(decisions.map(item => item.reviewerId)).size !== decisions.length ||
      new Set(decisions.map(item => item.reviewerRole)).size !== decisions.length) {
    throw new Error('Independent reviewers and unique roles are required.');
  }
  const byRole = new Map(decisions.map(item => [item.reviewerRole, item]));
  const initialOne = byRole.get('first_reviewer');
  if (!initialOne) throw new Error('First reviewer decision is required.');
  const initialTwo = byRole.get('second_reviewer');
  const adjudicator = byRole.get('adjudicator');
  if (!initialTwo && adjudicator) throw new Error('Adjudication requires two initial reviews.');
  let status: ReviewResolution['status'] = 'pending_second_review';
  let finalDecision: ReviewResolution['finalDecision'] = null;
  if (initialTwo) {
    if (initialOne.decision === initialTwo.decision) {
      if (adjudicator) throw new Error('Adjudication is not needed for agreement.');
      status = 'resolved'; finalDecision = initialOne.decision;
    } else if (adjudicator) {
      status = 'resolved'; finalDecision = adjudicator.decision;
    } else status = 'pending_adjudication';
  }
  return {
    reviewId: first.reviewId, queryId: first.queryId, policyVersion: first.policyVersion,
    status, finalDecision, reviewerIds: decisions.map(item => item.reviewerId).sort(),
  };
}

export function queueLeakageReview(
  store: ArtifactStore,
  queryId: string,
  queryText: string,
  audit: LeakageAuditResult,
  sourceManifestSha256: string
): string {
  if (audit.decision !== 'human_review') throw new Error('Only human-review decisions may be queued.');
  const payload = {
    queryId, queryText, audit, sourceManifestSha256,
    status: 'pending_human_review' as const,
  };
  const id = recordId('review', payload);
  store.writeRecord('review_queue', id, payload);
  return id;
}

export function recordReviewDecision(store: ArtifactStore, input: unknown): string {
  const decision = ReviewDecisionSchema.parse(input);
  if (!store.hasRecord('review_queue', decision.reviewId)) {
    throw new Error('Review decision has no matching pending case.');
  }
  const queued = store.readRecord<{ queryId: string }>('review_queue', decision.reviewId);
  if (queued.queryId !== decision.queryId) {
    throw new Error('Review decision query does not match the queued case.');
  }
  const id = recordId('decision', decision);
  store.writeRecord('review_decisions', id, decision);
  return id;
}

export function recordReviewResolution(store: ArtifactStore, decisionIds: readonly string[]): string {
  if (decisionIds.length < 2 || decisionIds.length > 3 ||
      new Set(decisionIds).size !== decisionIds.length) {
    throw new Error('Resolution requires two or three distinct decisions.');
  }
  const decisions = decisionIds.map(id => store.readRecord<ReviewDecision>('review_decisions', id));
  const resolution = resolveLeakageReview(decisions);
  if (resolution.status !== 'resolved') throw new Error('Review case is not resolved.');
  const payload = { ...resolution, decisionIds: [...decisionIds].sort() };
  const id = recordId('resolution', payload);
  store.writeRecord('review_resolutions', id, payload);
  return id;
}
