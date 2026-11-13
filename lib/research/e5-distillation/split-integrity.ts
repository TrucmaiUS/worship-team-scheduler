export const TRAIN_TOPIC_IDS = new Set(
  Array.from({ length: 10 }, (_, index) => `T${String(index + 1).padStart(2, '0')}`)
);

export const DIAGNOSTIC_TOPIC_IDS = new Set(
  Array.from({ length: 6 }, (_, index) => `T${String(index + 11).padStart(2, '0')}`)
);

export interface GenerationSource {
  topicIds: readonly string[];
  songIds: readonly string[];
  sectionIds: readonly string[];
  referencedQueryIds?: readonly string[];
}

export interface SplitIntegrityPolicy {
  anchorSongIds: ReadonlySet<string>;
  protectedQueryIds: ReadonlySet<string>;
}

export interface SplitIntegrityResult {
  eligible: boolean;
  reasons: string[];
}

export function validateGenerationSource(
  source: GenerationSource,
  policy: SplitIntegrityPolicy
): SplitIntegrityResult {
  const reasons: string[] = [];

  if (source.topicIds.length === 0) reasons.push('source_topic_missing');
  if (source.songIds.length === 0) reasons.push('source_song_missing');
  if (source.sectionIds.length === 0) reasons.push('source_section_missing');

  for (const topicId of source.topicIds) {
    if (DIAGNOSTIC_TOPIC_IDS.has(topicId)) {
      reasons.push(`diagnostic_topic_prohibited:${topicId}`);
    } else if (!TRAIN_TOPIC_IDS.has(topicId)) {
      reasons.push(`unknown_or_unapproved_topic:${topicId}`);
    }
  }

  for (const songId of source.songIds) {
    if (policy.anchorSongIds.has(songId)) {
      reasons.push(`anchor_song_prohibited:${songId}`);
    }
  }

  for (const queryId of source.referencedQueryIds ?? []) {
    if (policy.protectedQueryIds.has(queryId)) {
      reasons.push(`protected_query_prohibited:${queryId}`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

export function assertGenerationSourceEligible(
  source: GenerationSource,
  policy: SplitIntegrityPolicy
): void {
  const result = validateGenerationSource(source, policy);
  if (!result.eligible) {
    throw new Error(`Generation source rejected: ${result.reasons.join(', ')}`);
  }
}
