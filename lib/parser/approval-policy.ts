import { ApprovalStatus, ParsedSong } from './types';

/**
 * Determines the approval status for newly imported songs.
 *
 * System Policy:
 * Auto-approval is completely disabled. All imported songs must ALWAYS start
 * in 'pending_review' status so that a human worship leader or administrator
 * can review metadata, lyrics, and potential duplicates before approving.
 */
export function determineApprovalStatus(
  _song?: Partial<ParsedSong>
): ApprovalStatus {
  return 'pending_review';
}
