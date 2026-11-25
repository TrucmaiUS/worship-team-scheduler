import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function sha256(bytes: string | Buffer): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map(key =>
      JSON.stringify(key) + ':' + stableJson(record[key])
    ).join(',') + '}';
  }
  if (value === undefined) throw new Error('Undefined cannot be hashed.');
  return JSON.stringify(value);
}

export function recordId(kind: string, value: unknown): string {
  return kind + '_' + sha256(stableJson(value)).slice(0, 24);
}

export interface ArtifactManifest {
  schemaVersion: 'artifact-manifest-v1';
  artifact: string;
  recordCount: number;
  byteLength: number;
  sha256: string;
  upstreamSha256: string[];
  metadata: Record<string, string | number | boolean>;
}

function assertContained(root: string, file: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(resolvedRoot, file);
  if (!resolvedFile.startsWith(resolvedRoot + path.sep)) {
    throw new Error('Artifact path escapes the run directory.');
  }
  return resolvedFile;
}

// One immutable artifact per logical record. Exclusive creation makes retries
// idempotent and catches a changed payload under the same ID.
export class ArtifactStore {
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  writeRecord<T>(collection: string, id: string, value: T): string {
    if (!/^[a-z][a-z0-9_-]*$/i.test(collection) || !/^[a-z0-9_-]+$/i.test(id)) {
      throw new Error('Unsafe artifact collection or ID.');
    }
    const relative = path.join(collection, id + '.json');
    const target = assertContained(this.root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const bytes = stableJson(value) + '\n';
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temp, bytes, { flag: 'wx' });
      fs.linkSync(temp, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (fs.readFileSync(target, 'utf8') !== bytes) {
        throw new Error('Existing artifact differs for ID ' + id);
      }
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
    return sha256(bytes);
  }

  readRecord<T>(collection: string, id: string): T {
    return JSON.parse(fs.readFileSync(assertContained(this.root, path.join(collection, id + '.json')), 'utf8')) as T;
  }

  hasRecord(collection: string, id: string): boolean {
    return fs.existsSync(assertContained(this.root, path.join(collection, id + '.json')));
  }

  // JSONL is materialized atomically from immutable records. A crash leaves
  // individual records intact; a later call regenerates the same snapshot.
  materializeJsonl(
    collection: string,
    upstreamSha256: string[] = [],
    metadata: Record<string, string | number | boolean> = {}
  ): ArtifactManifest {
    if (!/^[a-z][a-z0-9_-]*$/i.test(collection)) throw new Error('Unsafe collection.');
    const dir = assertContained(this.root, collection);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort() : [];
    const content = files.map(name => fs.readFileSync(path.join(dir, name), 'utf8')).join('');
    const artifact = collection + '.jsonl';
    const target = assertContained(this.root, artifact);
    const manifest: ArtifactManifest = {
      schemaVersion: 'artifact-manifest-v1',
      artifact,
      recordCount: files.length,
      byteLength: Buffer.byteLength(content),
      sha256: sha256(content),
      upstreamSha256: [...upstreamSha256].sort(),
      metadata,
    };
    this.atomicReplace(target, content);
    this.atomicReplace(assertContained(this.root, collection + '.manifest.json'), stableJson(manifest) + '\n');
    return manifest;
  }

  private atomicReplace(target: string, content: string): void {
    const temp = target + '.' + crypto.randomUUID() + '.tmp';
    try {
      fs.writeFileSync(temp, content, { flag: 'wx' });
      fs.renameSync(temp, target);
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
}
