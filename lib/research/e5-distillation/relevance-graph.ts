import { ConsensusRecord } from './types';

export interface QueryRelevance {
  positiveSongIds: Set<string>;
  positiveSectionIds: Set<string>;
  verifiedNegativeSongIds: Set<string>;
  verifiedNegativeSectionIds: Set<string>;
  partialOrUnresolvedSongIds: Set<string>;
  partialOrUnresolvedSectionIds: Set<string>;
}

export interface KnownRelevanceGraph {
  byQueryId: Map<string, QueryRelevance>;
  sectionToSongId: Map<string, string>;
}

function getOrCreateQuery(graph: KnownRelevanceGraph, queryId: string): QueryRelevance {
  const existing = graph.byQueryId.get(queryId);
  if (existing) return existing;

  const created: QueryRelevance = {
    positiveSongIds: new Set(),
    positiveSectionIds: new Set(),
    verifiedNegativeSongIds: new Set(),
    verifiedNegativeSectionIds: new Set(),
    partialOrUnresolvedSongIds: new Set(),
    partialOrUnresolvedSectionIds: new Set(),
  };
  graph.byQueryId.set(queryId, created);
  return created;
}

export function buildKnownRelevanceGraph(
  records: readonly ConsensusRecord[]
): KnownRelevanceGraph {
  const graph: KnownRelevanceGraph = {
    byQueryId: new Map(),
    sectionToSongId: new Map(),
  };

  for (const record of records) {
    const existingSongId = graph.sectionToSongId.get(record.candidateSectionId);
    if (existingSongId && existingSongId !== record.candidateSongId) {
      throw new Error(
        `Section ${record.candidateSectionId} maps to multiple songs: ${existingSongId}, ${record.candidateSongId}`
      );
    }
    graph.sectionToSongId.set(record.candidateSectionId, record.candidateSongId);

    const query = getOrCreateQuery(graph, record.queryId);
    if (
      record.confidenceTier === 'high_confidence' &&
      record.automaticTrainingEligible &&
      record.consensusGrade !== null &&
      record.consensusGrade >= 2
    ) {
      query.positiveSongIds.add(record.candidateSongId);
      query.positiveSectionIds.add(record.candidateSectionId);
    } else if (
      record.confidenceTier === 'high_confidence' &&
      record.automaticTrainingEligible &&
      record.consensusGrade === 0
    ) {
      query.verifiedNegativeSongIds.add(record.candidateSongId);
      query.verifiedNegativeSectionIds.add(record.candidateSectionId);
    } else {
      query.partialOrUnresolvedSongIds.add(record.candidateSongId);
      query.partialOrUnresolvedSectionIds.add(record.candidateSectionId);
    }
  }

  // Song-level relevance dominates section-level negatives. A weak section from a
  // relevant song may be unsuitable as evidence, but it must not make that song a
  // contrastive negative for the same query.
  for (const query of graph.byQueryId.values()) {
    for (const positiveSongId of query.positiveSongIds) {
      query.verifiedNegativeSongIds.delete(positiveSongId);
    }
    for (const negativeSectionId of Array.from(query.verifiedNegativeSectionIds)) {
      const songId = graph.sectionToSongId.get(negativeSectionId);
      if (songId && query.positiveSongIds.has(songId)) {
        query.verifiedNegativeSectionIds.delete(negativeSectionId);
        query.partialOrUnresolvedSectionIds.add(negativeSectionId);
      }
    }
  }

  return graph;
}

export interface ContrastiveBatchExample {
  exampleId: string;
  queryId: string;
  positiveSongId: string;
  positiveSectionId: string;
  explicitNegativeSongIds?: readonly string[];
  explicitNegativeSectionIds?: readonly string[];
}

export interface BatchViolation {
  exampleId: string;
  type:
    | 'unknown_positive'
    | 'explicit_negative_is_known_positive'
    | 'explicit_negative_is_unresolved'
    | 'in_batch_false_negative';
  candidateId: string;
  message: string;
}

export interface BatchAuditResult {
  passed: boolean;
  violations: BatchViolation[];
}

export function auditContrastiveBatch(
  examples: readonly ContrastiveBatchExample[],
  graph: KnownRelevanceGraph
): BatchAuditResult {
  const violations: BatchViolation[] = [];

  for (const example of examples) {
    const relevance = graph.byQueryId.get(example.queryId);
    if (
      !relevance ||
      !relevance.positiveSongIds.has(example.positiveSongId) ||
      !relevance.positiveSectionIds.has(example.positiveSectionId)
    ) {
      violations.push({
        exampleId: example.exampleId,
        type: 'unknown_positive',
        candidateId: example.positiveSectionId,
        message: 'The batch positive is not a verified high-confidence positive.',
      });
      continue;
    }

    for (const songId of example.explicitNegativeSongIds ?? []) {
      if (relevance.positiveSongIds.has(songId)) {
        violations.push({
          exampleId: example.exampleId,
          type: 'explicit_negative_is_known_positive',
          candidateId: songId,
          message: 'A known positive song was supplied as an explicit negative.',
        });
      } else if (!relevance.verifiedNegativeSongIds.has(songId)) {
        violations.push({
          exampleId: example.exampleId,
          type: 'explicit_negative_is_unresolved',
          candidateId: songId,
          message: 'An explicit negative lacks a verified grade-0 consensus.',
        });
      }
    }

    for (const sectionId of example.explicitNegativeSectionIds ?? []) {
      const songId = graph.sectionToSongId.get(sectionId);
      if (relevance.positiveSectionIds.has(sectionId) || (songId && relevance.positiveSongIds.has(songId))) {
        violations.push({
          exampleId: example.exampleId,
          type: 'explicit_negative_is_known_positive',
          candidateId: sectionId,
          message: 'A positive section, or a section from a positive song, was supplied as a negative.',
        });
      } else if (!relevance.verifiedNegativeSectionIds.has(sectionId)) {
        violations.push({
          exampleId: example.exampleId,
          type: 'explicit_negative_is_unresolved',
          candidateId: sectionId,
          message: 'An explicit negative section lacks a verified grade-0 consensus.',
        });
      }
    }

    for (const other of examples) {
      if (other.exampleId === example.exampleId) continue;
      if (
        relevance.positiveSongIds.has(other.positiveSongId) ||
        relevance.positiveSectionIds.has(other.positiveSectionId)
      ) {
        violations.push({
          exampleId: example.exampleId,
          type: 'in_batch_false_negative',
          candidateId: other.positiveSectionId,
          message: `The positive from ${other.exampleId} is also relevant to query ${example.queryId}.`,
        });
      }
    }
  }

  return { passed: violations.length === 0, violations };
}
