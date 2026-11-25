/** Offline regression adapter only. Never imported by Teacher/Judge generation. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseCsv } from './corpus';
import {
  candidateFingerprint, registryFingerprint, LeakageRegistryV2Schema, LeakageAdjudicationV2Schema,
  type LeakageCandidateV2, type LeakageAdjudicationV2, type LeakageRegistryV2,
} from './leakage-v2';

export const PILOT_RUN = 'teacher-judge-pilot-v1-2026-11-19T10-54-35-956Z';
export const FINAL_PILOT_DIRECTORY = `outputs/${PILOT_RUN}-final-2026-11-25`;
export const PILOT_DIRECTORY = `benchmark/distillation/teacher_judge_pilot_runs/${PILOT_RUN}`;
const QRELS_SHA256 = '4b7487fccf95e85c5afbf6010f653a4800a31c88ebbcf1ee6e7e673ba41f094e';
const FINAL_MANIFEST_SHA256 = 'fc1338738923eb7ae73aa164fc565ee4cfe35c2075737cefb04eb118c2acc240';
const PILOT_REGISTRY_FINGERPRINT = 'aa92edc5ba3c3eb8349aec00112385bd8304110640aec1e2b76f0e2490ae7840';
export function fileSha256(filename: string): string {
  return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}
interface PilotPair {
  queryId: string; queryText: string; sourceSongId: string; sourceSectionId: string; sourceLyrics: string;
  pilotBucket: string; judgeSchemaPass: boolean;
}
interface FinalRecord {
  queryId: string; currentStatus: 'passed';
  changeHistory: Array<{ authority?: string; reason: string; changedAtUtc?: string; adjudicationDate?: string }>;
}
export function loadFrozenPilotLeakageV2(root: string, registrySnapshot?: LeakageRegistryV2) {
  const resolve = (relative: string) => path.resolve(root, relative);
  const readJson = (relative: string) => JSON.parse(fs.readFileSync(resolve(relative), 'utf8'));
  const inputs: Array<{ path: string; sha256: string }> = [];
  const unavailableHistoricalInputs: string[] = [];
  const verify = (relative: string, expected?: string) => {
    const hash = fileSha256(resolve(relative));
    if (expected && expected !== hash) throw new Error(`Frozen input hash mismatch: ${relative}`);
    if (!inputs.some(i => i.path === relative)) inputs.push({ path: relative, sha256: hash });
    return hash;
  };
  // A historical manifest is the authority, not values recomputed from edited rows.
  const finalManifestPath = `${FINAL_PILOT_DIRECTORY}/artifact_manifest_final.json`;
  verify(finalManifestPath, FINAL_MANIFEST_SHA256);
  const manifest = readJson(finalManifestPath) as { files: Array<{ name: string; sha256: string }> };
  for (const file of manifest.files) verify(`${FINAL_PILOT_DIRECTORY}/${file.name}`, file.sha256);
  const integrity = readJson(`${FINAL_PILOT_DIRECTORY}/integrity_verification_final.json`);
  for (const [absolute, hash] of Object.entries(integrity.protectedInputHashes as Record<string, string>)) {
    // Rebase historical Windows paths so the regression can run in another checkout.
    const portable = absolute.replaceAll('\\', '/');
    const relative = portable.split('/WORSHIP TEAM WEBSITE/')[1];
    if (!relative) throw new Error(`Unknown frozen input path: ${absolute}`);
    const required = relative.startsWith(`${PILOT_DIRECTORY}/`)
      || relative.endsWith('/judge_selection_reference_v2.json') || relative.endsWith('/frozen_judge_config.json');
    if (required || fs.existsSync(resolve(relative))) verify(relative, hash);
    else unavailableHistoricalInputs.push(relative);
  }
  const run = readJson(`${PILOT_DIRECTORY}/run_manifest.json`);
  for (const source of Object.values(run.sourceFiles) as Array<{ path: string; sha256: string }>) {
    verify(source.path, source.sha256);
  }
  verify(run.frozenJudgeConfig.path, run.frozenJudgeConfig.sha256);
  const rows = parseCsv(fs.readFileSync(resolve(run.sourceFiles.protectedQueries.path), 'utf8'));
  const references: LeakageRegistryV2['references'] = rows.map(r => ({
    id: `benchmark:${r.query_id}`, text: r.query_text,
    scope: /^T1[1-6]$/u.test(r.topic_id) ? 'diagnostic' : 'development',
    topicId: r.topic_id || null,
    kind: /title/iu.test(r.query_type) ? 'title' : /artist/iu.test(r.query_type) ? 'artist'
      : /raw topic/iu.test(r.query_type) ? 'topic_label'
        : /topic description/iu.test(r.query_type) ? 'topic_description' : 'query',
  }));
  const humanReference = readJson(run.sourceFiles.humanReference.path) as Array<{
    pairId: string; queryText: string; sourceTopicId: string | null;
  }>;
  references.push(...humanReference.map(r => ({ id: `human-reference:${r.pairId}`, text: r.queryText,
    scope: 'development' as const, topicId: r.sourceTopicId, kind: 'query' as const })));
  if (rows.length !== 90 || humanReference.length !== 50
    || references.filter(r => r.scope === 'diagnostic').length !== 14) throw new Error('Frozen registry counts changed.');
  // Only diagnostic positive mappings are read, only inside this isolated validator.
  // Legacy auto-authored qrels are NOT promoted to verified human adjudication.
  const diagnosticIds = new Set(references.filter(r => r.scope === 'diagnostic').map(r => r.id));
  const qrelsHash = registrySnapshot ? QRELS_SHA256 : verify('benchmark/data/qrels.csv', QRELS_SHA256);
  const mappings = registrySnapshot?.mappings ?? parseCsv(fs.readFileSync(resolve('benchmark/data/qrels.csv'), 'utf8'))
    .filter(r => diagnosticIds.has(`benchmark:${r.query_id}`) && Number(r.relevance) >= 2 && r.adjudicated === 'true')
    .map(r => ({ id: `diagnostic:${r.query_id}:${r.song_id}`, referenceId: `benchmark:${r.query_id}`,
      songId: r.song_id, provenance: { source: 'benchmark/data/qrels.csv (legacy, human provenance unverified)',
        sha256: qrelsHash, trust: 'legacy_unverified' as const } }));
  const registry = LeakageRegistryV2Schema.parse({ schemaVersion: 'leakage-registry-v2', references, mappings,
    externalCoverage: 'not_available' });
  if (registrySnapshot && registryFingerprint(registrySnapshot) !== registryFingerprint(registry)) {
    throw new Error('Registry snapshot differs from the frozen pilot reference set.');
  }
  const pairs = fs.readFileSync(resolve(`${PILOT_DIRECTORY}/pilot_pairs.jsonl`), 'utf8').trim().split(/\r?\n/u)
    .map(line => JSON.parse(line) as PilotPair);
  const candidates: LeakageCandidateV2[] = pairs.map(p => ({ queryId: p.queryId, queryText: p.queryText,
    songId: p.sourceSongId, sectionId: p.sourceSectionId, lyrics: p.sourceLyrics }));
  const auditPath = `${FINAL_PILOT_DIRECTORY}/leakage_audit_final.json`;
  const records = readJson(auditPath).records as FinalRecord[];
  if (pairs.length !== 50 || new Set(pairs.map(p => p.queryId)).size !== 50 || records.length !== 50
    || new Set(records.map(r => r.queryId)).size !== 50
    || records.some(r => r.currentStatus !== 'passed' || !pairs.some(p => p.queryId === r.queryId))) {
    throw new Error('Frozen pilot/adjudication identity mismatch.');
  }
  const registryHash = registryFingerprint(registry);
  if (registryHash !== PILOT_REGISTRY_FINGERPRINT) throw new Error('Frozen pilot registry fingerprint mismatch.');
  // Only actual recorded decisions get an approval. The 40 original passes do not.
  const adjudications: LeakageAdjudicationV2[] = records.filter(r => r.changeHistory.length).map(r => {
    const last = r.changeHistory.at(-1)!;
    return LeakageAdjudicationV2Schema.parse({ id: `final-human:${r.queryId}:2026-11-25`,
      candidateFingerprint: candidateFingerprint(candidates.find(c => c.queryId === r.queryId)!),
      registryFingerprint: registryHash, decision: r.currentStatus,
      authority: last.authority ?? 'Explicit user Human Adjudication in final checkpoint',
      date: last.adjudicationDate ?? last.changedAtUtc?.slice(0, 10), rationale: last.reason,
      provenance: { source: auditPath, sha256: fileSha256(resolve(auditPath)), trust: 'approved' },
    });
  });
  if (adjudications.length !== 10) throw new Error('Expected exactly ten recorded human leakage adjudications.');
  return { registry, candidates, adjudications, expected: records.map(r => ({ queryId: r.queryId, status: r.currentStatus })),
    pairs, inputs, unavailableHistoricalInputs,
    restrictions: { externalLabelsRead: false, modelCalls: 0, trainingStarted: false } };
}
