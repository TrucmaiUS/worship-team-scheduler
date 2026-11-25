import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { auditQueryLeakage } from './leakage';
import type { LeakageAuditResult, ReferenceText } from './types';
import type { CorpusSection } from './corpus';
import { inspectHeldOutIntent } from './held-out-intent';

export const FROZEN_E5 = {
  modelId: 'Xenova/multilingual-e5-small',
  revision: 'main',
  quantized: true,
  runtimeVersion: '2.17.2',
  onnxSha256: 'f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193',
  tokenizerSha256: '0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39',
  configSha256: 'cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1',
} as const;

const requirePackage = createRequire(import.meta.url);
type Extractor = (text: string, options: { pooling: string; normalize: boolean }) =>
  Promise<{ data: Float32Array | number[] }>;

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function verifyFrozenE5Cache(cacheRoot: string): void {
  const packageVersion = requirePackage('@xenova/transformers/package.json').version;
  if (packageVersion !== FROZEN_E5.runtimeVersion) throw new Error('E5 runtime version mismatch.');
  const root = path.resolve(cacheRoot, 'Xenova', 'multilingual-e5-small');
  const expected = [
    ['onnx/model_quantized.onnx', FROZEN_E5.onnxSha256],
    ['tokenizer.json', FROZEN_E5.tokenizerSha256],
    ['config.json', FROZEN_E5.configSha256],
  ] as const;
  for (const [relative, hash] of expected) {
    const file = path.join(root, relative);
    if (!fs.existsSync(file) || sha256File(file) !== hash) {
      throw new Error(`Frozen E5 artifact missing or hash mismatch: ${relative}`);
    }
  }
}

export class FrozenE5Scorer {
  private extractor: Extractor | null = null;
  private readonly cache = new Map<string, number[]>();

  constructor(private readonly cacheRoot: string) {}

  private async getExtractor(): Promise<Extractor> {
    if (!this.extractor) {
      verifyFrozenE5Cache(this.cacheRoot);
      // Optional research runtime: load only after the pinned local cache check.
      // A non-literal import keeps the website build independent of this package.
      const runtimePackage: string = '@xenova/transformers';
      const { pipeline } = await import(runtimePackage);
      this.extractor = await pipeline('feature-extraction', FROZEN_E5.modelId, {
        revision: FROZEN_E5.revision,
        quantized: FROZEN_E5.quantized,
        local_files_only: true,
        cache_dir: this.cacheRoot,
      }) as Extractor;
    }
    return this.extractor;
  }

  private async embedWithPrefix(prefix: 'query: ' | 'passage: ', text: string): Promise<number[]> {
    const key = prefix + text.trim();
    if (!text.trim()) throw new Error('Cannot embed empty text.');
    const cached = this.cache.get(key);
    if (cached) return cached;
    const extractor = await this.getExtractor();
    const output = await extractor(key, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data);
    if (vector.length !== 384 || vector.some(value => !Number.isFinite(value))) {
      throw new Error('Frozen E5 returned an invalid vector.');
    }
    this.cache.set(key, vector);
    return vector;
  }

  async embed(text: string): Promise<number[]> {
    return this.embedWithPrefix('query: ', text);
  }

  async embedPassage(text: string): Promise<number[]> {
    return this.embedWithPrefix('passage: ', text);
  }

  async scoreSections(query: string, sections: readonly CorpusSection[]): Promise<Map<string, number>> {
    const queryVector = await this.embed(query);
    const scores = new Map<string, number>();
    for (const section of sections) {
      const passage = await this.embedPassage(section.passageText);
      scores.set(section.sectionId,
        queryVector.reduce((sum, value, i) => sum + value * passage[i], 0));
    }
    return scores;
  }

  async score(query: string, references: readonly ReferenceText[]): Promise<Record<string, number>> {
    const queryVector = await this.embed(query);
    const scores: Record<string, number> = {};
    for (const reference of references) {
      if (reference.id in scores) throw new Error('Duplicate reference ID: ' + reference.id);
      const vector = await this.embed(reference.text);
      scores[reference.id] = queryVector.reduce((sum, value, i) => sum + value * vector[i], 0);
    }
    return scores;
  }

  async audit(queryText: string, references: ReferenceText[]): Promise<LeakageAuditResult> {
    const scores = await this.score(queryText, references);
    const intent = inspectHeldOutIntent(queryText);
    return auditQueryLeakage({
      queryText,
      references,
      frozenE5CosineByReferenceId: scores,
      heldOutIntentFlag: intent.explicit,
      requiresHumanReview: intent.requiresHumanReview,
    });
  }
}
