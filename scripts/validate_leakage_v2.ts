/** Offline only: no env loading, API clients, embeddings or training imports. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { auditQueryLeakageV2, LeakageRegistryV2Schema, LeakageCandidateV2Schema,
  LEAKAGE_V2_VERSION, type LeakageAdjudicationV2 } from '../lib/research/e5-distillation/leakage-v2';
import { fileSha256, loadFrozenPilotLeakageV2, PILOT_DIRECTORY, FINAL_PILOT_DIRECTORY } from '../lib/research/e5-distillation/leakage-v2-pilot';

const args = process.argv.slice(2);
const value = (name: string) => {
  const at = args.indexOf(name);
  if (at < 0) return undefined;
  if (!args[at + 1] || args[at + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[at + 1];
};
const options = new Set(['--pilot-regression', '--registry', '--candidates', '--adjudications', '--out', '--require-external']);
for (let i = 0; i < args.length; i++) {
  if (!options.has(args[i])) throw new Error(`Unknown argument ${args[i]}`);
  if (!['--pilot-regression', '--require-external'].includes(args[i])) i++;
}
const root = process.cwd();
const pilot = args.includes('--pilot-regression');
if (!pilot && (!value('--registry') || !value('--candidates'))) {
  throw new Error('Use --pilot-regression, or provide --registry and --candidates. No models are called.');
}
if (pilot && (value('--candidates') || value('--adjudications'))) throw new Error('Pilot inputs are frozen.');
const readJson = (filename: string) => JSON.parse(fs.readFileSync(filename, 'utf8'));
const registryPath = value('--registry');
const providedRegistry = registryPath ? LeakageRegistryV2Schema.parse(readJson(registryPath)) : undefined;
const loaded = pilot ? loadFrozenPilotLeakageV2(root, providedRegistry) : undefined;
const registry = loaded?.registry ?? providedRegistry!;
const candidatesPath = value('--candidates');
const candidates = loaded?.candidates ?? fs.readFileSync(candidatesPath!, 'utf8').trim().split(/\r?\n/u)
  .map(line => LeakageCandidateV2Schema.parse(JSON.parse(line)));
if (new Set(candidates.map(c => c.queryId)).size !== candidates.length) throw new Error('Duplicate candidate IDs.');
const approvalPath = value('--adjudications');
const adjudications: LeakageAdjudicationV2[] = loaded?.adjudications ?? (approvalPath ? readJson(approvalPath) : []);
const inputs = [...(loaded?.inputs ?? []), ...[registryPath, candidatesPath, approvalPath].filter((x): x is string => !!x)
  .map(p => ({ path: path.relative(root, path.resolve(p)).replaceAll('\\', '/'), sha256: fileSha256(p) }))];
const codePaths = ['lib/research/e5-distillation/leakage-v2.ts', 'lib/research/e5-distillation/leakage-v2-pilot.ts',
  'lib/research/e5-distillation/normalization.ts', 'lib/research/e5-distillation/corpus.ts',
  'lib/research/e5-distillation/__tests__/leakage-v2.test.ts', 'scripts/validate_leakage_v2.ts',
  'docs/research/e5_distillation/leakage_validator_v2.md', 'docs/research/e5_distillation/topic_leakage_audit.md',
  'docs/research/e5_distillation/evaluation_protocol.md', 'docs/research/e5_distillation/external_test_specification.md',
  'package.json', 'package-lock.json'];
const codeHashes = codePaths.map(p => ({ path: p, sha256: fileSha256(p) }));
const requireExternalCoverage = args.includes('--require-external');
const records = candidates.map(candidate => {
  const before = auditQueryLeakageV2({ candidate, registry, requireExternalCoverage });
  const after = auditQueryLeakageV2({ candidate, registry, adjudications, requireExternalCoverage });
  return { queryId: candidate.queryId, automaticStatus: before.status, finalStatus: after.status, result: after };
});
const count = (statuses: string[]) => statuses.reduce<Record<string, number>>((acc, s) => {
  acc[s] = (acc[s] ?? 0) + 1; return acc;
}, {});
const mismatches = loaded ? records.filter(r => loaded.expected.find(e => e.queryId === r.queryId)?.status !== r.finalStatus)
  .map(r => ({ queryId: r.queryId, actual: r.finalStatus,
    expected: loaded.expected.find(e => e.queryId === r.queryId)?.status })) : [];
const integrity = inputs.map(input => ({ ...input, unchanged: fileSha256(path.resolve(root, input.path)) === input.sha256 }));
const unchanged = integrity.every(i => i.unchanged);
const timestamp = new Date().toISOString();
const out = path.resolve(value('--out') ?? `outputs/leakage-validator-v2-${timestamp.replaceAll(':', '-').replaceAll('.', '-')}`);
if (fs.existsSync(out)) throw new Error(`Refusing to overwrite existing output directory: ${out}`);
for (const relative of [PILOT_DIRECTORY, FINAL_PILOT_DIRECTORY, 'benchmark/distillation/human_reference',
  'benchmark/distillation/judge_selection_runs', 'benchmark/data']) {
  const immutable = path.resolve(root, relative);
  if (out === immutable || out.startsWith(`${immutable}${path.sep}`)) throw new Error('Output is inside an immutable source directory.');
}
// Ensure the output cannot be placed inside or above immutable input directories.
for (const input of inputs) {
  const target = path.resolve(root, input.path);
  if (target === out || target.startsWith(`${out}${path.sep}`) || out === path.dirname(target)) {
    throw new Error('Output overlaps a protected input location.');
  }
}
const git = (command: string[]) => execFileSync('git', command, { encoding: 'utf8', cwd: root }).trim();
const report = {
  schemaVersion: 'leakage-v2-offline-report-v1', validatorVersion: LEAKAGE_V2_VERSION, createdAtUtc: timestamp,
  mode: pilot ? 'frozen_pilot_regression' : 'offline_candidate_validation',
  codeCommit: git(['rev-parse', 'HEAD']), codeDirty: !!git(['status', '--porcelain']), codeHashes,
  command: ['npx', 'tsx', 'scripts/validate_leakage_v2.ts', ...args],
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  counts: { records: records.length, automatic: count(records.map(r => r.automaticStatus)),
    final: count(records.map(r => r.finalStatus)),
    recordedHumanAdjudications: adjudications.length,
    decisionsChangedByAdjudication: records.filter(r => r.automaticStatus !== r.finalStatus).map(r => r.queryId) },
  registryCoverage: { references: registry.references.length, diagnosticReferences: registry.references.filter(r => r.scope === 'diagnostic').length,
    mappings: registry.mappings.length, externalCoverage: registry.externalCoverage, semanticScoresProvided: 0,
    mappingProvenance: 'See per-mapping trust; legacy_unverified is not human gold' },
  regression: { applicable: pilot, passed: pilot ? mismatches.length === 0 && unchanged : null, mismatches },
  inputIntegrity: { unchanged, files: integrity, unavailableHistoricalInputs: loaded?.unavailableHistoricalInputs ?? [] },
  restrictions: { teacherCalls: 0, judgeCalls: 0, embeddingCalls: 0, externalTestLabelsRead: false,
    generatedQueries: 0, hardNegativesCreated: 0, trainingStarted: false, trainingEligibilityGranted: false },
  records,
};
fs.mkdirSync(out, { recursive: true });
const write = (name: string, data: unknown) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
write('regression_results.json', report);
write('protected_registry.json', registry);
write('scoped_adjudications.json', adjudications);
write('integrity_verification.json', report.inputIntegrity);
write('execution_log.json', { startedFrom: root, ...report.environment, mode: report.mode, command: report.command,
  createdAtUtc: timestamp, codeCommit: report.codeCommit, codeDirty: report.codeDirty, codeHashes,
  restrictions: report.restrictions, result: report.regression });
const rows = records.map(r => `| ${r.queryId} | ${r.automaticStatus} | ${r.finalStatus} | ${r.result.appliedAdjudication?.id ?? '—'} |`).join('\n');
const assessment = `# Leakage Validator v2 — Offline ${pilot ? 'Pilot Regression' : 'Validation'}\n\n`
  + `Ngày chạy UTC: ${timestamp}. Phiên bản: ${LEAKAGE_V2_VERSION}. Commit nền: ${report.codeCommit}; dirty=${report.codeDirty}. Hash từng source trong regression_results.json.\n\n`
  + `## Kết quả\n\n${records.length} records; tự động: ${JSON.stringify(report.counts.automatic)}; sau adjudication: ${JSON.stringify(report.counts.final)}.\n\n`
  + `Có ${adjudications.length} quyết định Human Adjudication có provenance; chỉ ${report.counts.decisionsChangedByAdjudication.join(', ') || 'không có record nào'} cần thay đổi quyết định tự động. `
  + `Regression ${pilot ? report.regression.passed ? 'PASS' : 'FAIL' : 'không áp dụng'}; dữ liệu đầu vào bảo toàn: ${unchanged}.\n\n`
  + `| Record | Pipeline tự động | Sau adjudication | Quyết định được kế thừa |\n|---|---|---|---|\n${rows}\n\n`
  + `## Diễn giải và giới hạn\n\n`
  + `Vocabulary, lexical scores, semantic intent và protected supervision được ghi riêng. Không cách ly toàn bộ song hoặc section. `
  + (pilot ? `TP043 kế thừa quyết định Human Adjudication ngày 25/11/2026 bằng fingerprint nội dung và registry, không có allowlist theo ID/topic.\n\n` : '\n\n')
  + `Không chạy Teacher, Judge hoặc embedding. Không có semantic cosine thực đo trong lần chạy này; ${registry.references.length} protected records, trong đó ${report.registryCoverage.diagnosticReferences} diagnostic. `
  + `External coverage: ${registry.externalCoverage}; không đọc external labels. Bộ quy tắc song ngữ có phạm vi hữu hạn, không phải bộ chứng minh semantic intent đầy đủ. `
  + `Kết quả 50/50 trên pilot đã biết không ước lượng được recall với leakage mới. Unit fixtures kiểm tra các vi phạm được kiểm soát, không phải queries được tạo cho training.\n\n`
  + `${registry.mappings.length} mappings; ${registry.mappings.filter(m => m.provenance.trust === 'legacy_unverified').length} là legacy_unverified: adjudicated=true của qrels không chứng minh đã có human adjudication. `
  + `Cùng mapping chỉ xác nhận khi có cùng intent/explicit supervision reuse và provenance phù hợp; cùng song/section riêng lẻ không đủ.\n\n`
  + `Leakage passed không đồng nghĩa được dùng training. `
  + (pilot ? `TP012/TP040 vẫn invalid Judge outputs; TP018 vẫn rejected_validation trong pilot gốc. ` : '')
  + `Không có cập nhật Human decisions, Human Reference, frozen Qwen, workbook hay snapshot pilot. Dừng tại checkpoint.\n`;
fs.writeFileSync(path.join(out, 'regression_report.md'), assessment, { flag: 'wx' });
const artifacts = fs.readdirSync(out).map(name => ({ name, sha256: fileSha256(path.join(out, name)) }));
write('artifact_manifest.json', { schemaVersion: 'leakage-v2-artifact-manifest-v1', createdAtUtc: timestamp, artifacts });
console.log(JSON.stringify({ out, counts: report.counts, regression: report.regression, inputsUnchanged: unchanged }, null, 2));
if (!unchanged || mismatches.length || (!pilot && records.some(r => r.finalStatus !== 'passed'))) process.exitCode = 1;
