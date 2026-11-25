import fs from 'fs';
import path from 'path';

interface QrelEntry {
  query_id: string;
  song_id: string;
  relevance: number;
  adjudicated: boolean;
}

interface RunResultSong {
  song_id: string;
  display_title: string;
  rank: number;
  score: number;
}

interface RunResultQuery {
  query_id: string;
  query_text: string;
  group: string;
  topic_id: string | null;
  retrieval_ms: number;
  rerank_ms: number;
  total_latency_ms: number;
  results: RunResultSong[];
}

interface BenchmarkRunFile {
  experiment_id: string;
  method_name: string;
  timestamp: string;
  total_queries: number;
  runs: RunResultQuery[];
}

interface QueryMetrics {
  query_id: string;
  group: string;
  topic_id: string | null;
  ndcg3: number;
  mrr10: number;
  hit3: number;
  recall10: number;
  precision3: number;
  latency_ms: number;
}

interface AggregateSummary {
  experiment_id: string;
  method_name: string;
  total_queries: number;
  ndcg3: number;
  mrr10: number;
  hit3_percent: number;
  recall10: number;
  precision3: number;
  mean_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  by_group: Record<string, {
    count: number;
    ndcg3: number;
    mrr10: number;
    hit3_percent: number;
    recall10: number;
    precision3: number;
  }>;
  by_topic?: Record<string, {
    count: number;
    ndcg3: number;
    mrr10: number;
    hit3_percent: number;
  }>;
}

function parseCsv(filePath: string): string[][] {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 1) rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

export function loadQrels(): Map<string, Map<string, number>> {
  const qrelsPath = path.resolve(__dirname, '../benchmark/data/qrels.csv');
  const rows = parseCsv(qrelsPath);
  const headers = rows[0];

  const qIdIdx = headers.indexOf('query_id');
  const songIdIdx = headers.indexOf('song_id');
  const relIdx = headers.indexOf('relevance');

  const qrelsMap = new Map<string, Map<string, number>>();

  for (let i = 1; i < rows.length; i++) {
    const qId = rows[i][qIdIdx];
    const songId = rows[i][songIdIdx];
    const rel = parseInt(rows[i][relIdx], 10) || 0;

    if (!qrelsMap.has(qId)) {
      qrelsMap.set(qId, new Map());
    }
    qrelsMap.get(qId)!.set(songId, rel);
  }

  return qrelsMap;
}

function calculateDcg(gains: number[]): number {
  let dcg = 0;
  for (let i = 0; i < gains.length; i++) {
    const rel = gains[i];
    const rank = i + 1;
    // Standard 2^rel - 1 formulation
    dcg += (Math.pow(2, rel) - 1) / Math.log2(rank + 1);
  }
  return dcg;
}

export function evaluateRun(
  runFile: BenchmarkRunFile,
  qrelsMap: Map<string, Map<string, number>>
): { summary: AggregateSummary; queryMetrics: QueryMetrics[] } {
  const queryMetrics: QueryMetrics[] = [];

  for (const qRun of runFile.runs) {
    const qId = qRun.query_id;
    const songQrels = qrelsMap.get(qId) || new Map<string, number>();

    // Top 3 results
    const top3 = qRun.results.slice(0, 3);
    const top3Gains = top3.map(r => songQrels.get(r.song_id) || 0);

    // DCG@3
    const dcg3 = calculateDcg(top3Gains);

    // IDCG@3: All judged songs for this query sorted descending
    const allJudgedGains = Array.from(songQrels.values()).sort((a, b) => b - a);
    const idealTop3Gains = allJudgedGains.slice(0, 3);
    const idcg3 = calculateDcg(idealTop3Gains);

    const ndcg3 = idcg3 > 0 ? dcg3 / idcg3 : 0.0;

    // Top 10 results
    const top10 = qRun.results.slice(0, 10);

    // MRR@10: first song with relevance >= 2
    let mrr10 = 0.0;
    for (let i = 0; i < top10.length; i++) {
      const rel = songQrels.get(top10[i].song_id) || 0;
      if (rel >= 2) {
        mrr10 = 1.0 / (i + 1);
        break;
      }
    }

    // Hit@3: any song with relevance >= 2 in top 3
    const hit3 = top3Gains.some(rel => rel >= 2) ? 1.0 : 0.0;

    // Recall@10: count of relevant songs in top 10 / total relevant songs for query
    const totalRelevant = Array.from(songQrels.values()).filter(rel => rel >= 2).length;
    const retrievedRelevantIn10 = top10.filter(r => (songQrels.get(r.song_id) || 0) >= 2).length;
    const recall10 = totalRelevant > 0 ? retrievedRelevantIn10 / totalRelevant : 0.0;

    // Precision@3: proportion of top 3 that are relevant
    const relevantIn3 = top3Gains.filter(rel => rel >= 2).length;
    const precision3 = relevantIn3 / 3.0;

    queryMetrics.push({
      query_id: qId,
      group: qRun.group,
      topic_id: qRun.topic_id,
      ndcg3,
      mrr10,
      hit3,
      recall10,
      precision3,
      latency_ms: qRun.total_latency_ms,
    });
  }

  // Latencies
  const latencies = queryMetrics.map(m => m.latency_ms).sort((a, b) => a - b);
  const meanLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  // Group Breakdown
  const groups = ['G1', 'G2', 'G3', 'G4'];
  const byGroup: Record<string, any> = {};

  for (const g of groups) {
    const subset = queryMetrics.filter(m => m.group === g);
    const count = subset.length;
    if (count === 0) continue;

    byGroup[g] = {
      count,
      ndcg3: subset.reduce((acc, m) => acc + m.ndcg3, 0) / count,
      mrr10: subset.reduce((acc, m) => acc + m.mrr10, 0) / count,
      hit3_percent: (subset.reduce((acc, m) => acc + m.hit3, 0) / count) * 100,
      recall10: subset.reduce((acc, m) => acc + m.recall10, 0) / count,
      precision3: subset.reduce((acc, m) => acc + m.precision3, 0) / count,
    };
  }

  // Topic Breakdown for G2 (if applicable)
  const byTopic: Record<string, any> = {};
  const g2Metrics = queryMetrics.filter(m => m.group === 'G2' && m.topic_id);
  const topicIds = Array.from(new Set(g2Metrics.map(m => m.topic_id!))).sort();

  for (const tid of topicIds) {
    const subset = g2Metrics.filter(m => m.topic_id === tid);
    const count = subset.length;
    if (count > 0) {
      byTopic[tid] = {
        count,
        ndcg3: subset.reduce((acc, m) => acc + m.ndcg3, 0) / count,
        mrr10: subset.reduce((acc, m) => acc + m.mrr10, 0) / count,
        hit3_percent: (subset.reduce((acc, m) => acc + m.hit3, 0) / count) * 100,
      };
    }
  }

  const n = queryMetrics.length || 1;
  const summary: AggregateSummary = {
    experiment_id: runFile.experiment_id,
    method_name: runFile.method_name,
    total_queries: queryMetrics.length,
    ndcg3: queryMetrics.reduce((acc, m) => acc + m.ndcg3, 0) / n,
    mrr10: queryMetrics.reduce((acc, m) => acc + m.mrr10, 0) / n,
    hit3_percent: (queryMetrics.reduce((acc, m) => acc + m.hit3, 0) / n) * 100,
    recall10: queryMetrics.reduce((acc, m) => acc + m.recall10, 0) / n,
    precision3: queryMetrics.reduce((acc, m) => acc + m.precision3, 0) / n,
    mean_latency_ms: meanLatency,
    p50_latency_ms: p50,
    p95_latency_ms: p95,
    by_group: byGroup,
    by_topic: Object.keys(byTopic).length > 0 ? byTopic : undefined,
  };

  return { summary, queryMetrics };
}

export async function runEvaluation() {
  console.log('===============================================================');
  console.log('       WORSHIP TEAM SEARCH EVALUATOR MODULE (v3)');
  console.log('===============================================================');

  const qrelsMap = loadQrels();
  console.log(`Loaded qrels for ${qrelsMap.size} queries.`);

  const rawDir = path.resolve(__dirname, '../benchmark/results/raw');
  const reportsDir = path.resolve(__dirname, '../benchmark/results/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const runFiles = [
    'run_e1_keyword.json',
    'run_e2_semantic.json',
    'run_e3_hybrid.json',
    'run_e4_reranked.json',
    'run_a1_raw_topic.json',
    'run_a2_expanded_topic.json',
  ];

  const allSummaries: AggregateSummary[] = [];

  for (const fileName of runFiles) {
    const fullPath = path.join(rawDir, fileName);
    if (!fs.existsSync(fullPath)) {
      console.warn(`[Evaluation] Warning: Run file ${fileName} not found. Skipping.`);
      continue;
    }

    const runFile: BenchmarkRunFile = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const { summary } = evaluateRun(runFile, qrelsMap);
    allSummaries.push(summary);
  }

  // Save JSON summary
  const summaryPath = path.join(reportsDir, 'benchmark_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(allSummaries, null, 2), 'utf8');
  console.log(`Saved evaluation summary to: ${summaryPath}\n`);

  // Format Markdown Comparison Tables
  console.log('### Primary Retrieval Systems (E1 – E4)');
  console.log('| Config | Method | nDCG@3 | MRR@10 | Hit@3 (%) | Recall@10 | Precision@3 | Latency p50 | Latency p95 |');
  console.log('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  const mainConfigs = allSummaries.filter(s => ['E1', 'E2', 'E3', 'E4'].includes(s.experiment_id));
  for (const s of mainConfigs) {
    console.log(`| **${s.experiment_id}** | ${s.method_name} | **${s.ndcg3.toFixed(3)}** | ${s.mrr10.toFixed(3)} | ${s.hit3_percent.toFixed(1)}% | ${s.recall10.toFixed(3)} | ${s.precision3.toFixed(3)} | ${s.p50_latency_ms.toFixed(1)}ms | ${s.p95_latency_ms.toFixed(1)}ms |`);
  }

  console.log('\n### Performance by Query Group (nDCG@3 / Hit@3)');
  console.log('| Query Group | Total | E1 Keyword | E2 Semantic | E3 Hybrid | E4 Reranked |');
  console.log('| :--- | :---: | :---: | :---: | :---: | :---: |');

  const groupLabels: Record<string, string> = {
    G1: 'G1: Title & Artist (12)',
    G2: 'G2: Topic Matching (42)',
    G3: 'G3: Lyric Search (24)',
    G4: 'G4: Ambiguity & Edge (12)',
  };

  for (const g of ['G1', 'G2', 'G3', 'G4']) {
    const e1 = mainConfigs.find(s => s.experiment_id === 'E1')?.by_group[g];
    const e2 = mainConfigs.find(s => s.experiment_id === 'E2')?.by_group[g];
    const e3 = mainConfigs.find(s => s.experiment_id === 'E3')?.by_group[g];
    const e4 = mainConfigs.find(s => s.experiment_id === 'E4')?.by_group[g];

    console.log(`| **${groupLabels[g]}** | ${e1?.count || 0} | ${e1?.ndcg3.toFixed(3)} (${e1?.hit3_percent.toFixed(0)}%) | ${e2?.ndcg3.toFixed(3)} (${e2?.hit3_percent.toFixed(0)}%) | ${e3?.ndcg3.toFixed(3)} (${e3?.hit3_percent.toFixed(0)}%) | ${e4?.ndcg3.toFixed(3)} (${e4?.hit3_percent.toFixed(0)}%) |`);
  }

  // Topic Ablation (A1 vs A2)
  const a1 = allSummaries.find(s => s.experiment_id === 'A1');
  const a2 = allSummaries.find(s => s.experiment_id === 'A2');
  if (a1 && a2) {
    console.log('\n### Topic Interpretation Ablation (A1 vs A2 on Group 2 Topics)');
    console.log('| Ablation Condition | Description | nDCG@3 | MRR@10 | Hit@3 (%) | Recall@10 | Precision@3 | Mean Latency |');
    console.log('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |');
    console.log(`| **A1: Raw Query** | Raw topic text directly to Hybrid Retrieval | ${a1.ndcg3.toFixed(3)} | ${a1.mrr10.toFixed(3)} | ${a1.hit3_percent.toFixed(1)}% | ${a1.recall10.toFixed(3)} | ${a1.precision3.toFixed(3)} | ${a1.mean_latency_ms.toFixed(1)}ms |`);
    console.log(`| **A2: Interpreted** | Topic structured expansion -> Hybrid Retrieval | ${a2.ndcg3.toFixed(3)} | ${a2.mrr10.toFixed(3)} | ${a2.hit3_percent.toFixed(1)}% | ${a2.recall10.toFixed(3)} | ${a2.precision3.toFixed(3)} | ${a2.mean_latency_ms.toFixed(1)}ms |`);
  }
}

if (require.main === module) {
  runEvaluation().catch(err => {
    console.error('[Evaluator] Fatal error:', err);
    process.exit(1);
  });
}
