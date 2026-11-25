import fs from 'fs';
import path from 'path';
import { LocalE5EmbeddingProvider } from '../lib/search/embedding-service';

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',');
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Basic CSV parser handling quotes
    const line = lines[i];
    const row: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h.trim()] = row[idx] || '';
    });
    records.push(rec);
  }
  return records;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function runTopicAudit() {
  const topicsPath = path.resolve('benchmark/data/topics.csv');
  const topics = parseCsv(topicsPath);
  console.log(`Loaded ${topics.length} topics from topics.csv`);

  const provider = new LocalE5EmbeddingProvider();

  // Create text representation for each topic: title + description + taxonomy
  const topicTexts = topics.map(t => {
    const text = `${t.title}. ${t.description} (Taxonomy: ${t.taxonomy})`.trim();
    return { id: t.topic_id, title: t.title, taxonomy: t.taxonomy, text };
  });

  const embeddings: number[][] = [];
  for (const t of topicTexts) {
    const vec = await provider.embedQuery(t.text);
    embeddings.push(vec);
  }

  const trainTopics = topicTexts.filter((t, idx) => idx < 10); // T01 - T10
  const heldOutTopics = topicTexts.filter((t, idx) => idx >= 10); // T11 - T16

  console.log('\n=== PAIRWISE TOPIC SIMILARITY: TRAIN (T01-T10) vs HELD-OUT (T11-T16) ===\n');
  const overlapTable: any[] = [];

  for (let hIdx = 0; hIdx < heldOutTopics.length; hIdx++) {
    const ht = heldOutTopics[hIdx];
    const hGlobalIdx = 10 + hIdx;
    const hVec = embeddings[hGlobalIdx];

    const similarities: { train_id: string; train_title: string; similarity: number }[] = [];

    for (let tIdx = 0; tIdx < trainTopics.length; tIdx++) {
      const tt = trainTopics[tIdx];
      const sim = dot(hVec, embeddings[tIdx]);
      similarities.push({
        train_id: tt.id,
        train_title: tt.title,
        similarity: Number(sim.toFixed(4)),
      });
    }

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topOverlap = similarities[0];
    const secondOverlap = similarities[1];

    overlapTable.push({
      held_out_id: ht.id,
      held_out_title: ht.title,
      held_out_taxonomy: ht.taxonomy,
      max_train_match: `${topOverlap.train_id} (${topOverlap.train_title})`,
      max_similarity: topOverlap.similarity,
      second_train_match: `${secondOverlap.train_id} (${secondOverlap.train_title})`,
      second_similarity: secondOverlap.similarity,
    });
  }

  console.table(overlapTable);

  const outPath = path.resolve('docs/research/e5_distillation/topic_similarity_matrix.json');
  fs.writeFileSync(outPath, JSON.stringify(overlapTable, null, 2), 'utf8');
  console.log(`Saved similarity matrix to ${outPath}`);
  process.exit(0);
}

runTopicAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
