import crypto from 'crypto';
import db from '@/lib/db';
import { EmbeddingProvider } from './types';

/**
 * High-performance deterministic semantic feature encoder (768 dimensions).
 * Operates offline with zero external network dependencies, ensuring reproducible
 * benchmarks, unit tests, and CI/CD operation.
 * Normalizes output vector to unit length so Cosine Distance = 1 - DotProduct.
 */
export class DeterministicSemanticProvider implements EmbeddingProvider {
  name = 'semantic-projector-768';
  dimension = 768;

  async embedText(text: string): Promise<number[]> {
    const vec = new Float64Array(this.dimension);
    if (!text || !text.trim()) {
      return Array.from(vec);
    }

    // Tokenize and clean Vietnamese and English text
    const clean = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');

    const words = clean.split(/\s+/).filter(Boolean);

    // Project tokens, bigrams, and character trigrams into 768-d space
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      this.projectToken(w, vec, 1.0);

      // Bigram projection for context
      if (i < words.length - 1) {
        const bigram = `${w}_${words[i + 1]}`;
        this.projectToken(bigram, vec, 1.5);
      }

      // Trigrams for root words
      if (w.length >= 3) {
        for (let j = 0; j <= w.length - 3; j++) {
          const tri = w.substring(j, j + 3);
          this.projectToken(tri, vec, 0.4);
        }
      }
    }

    // L2 Normalize to unit vector
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vec[i] /= norm;
      }
    }

    return Array.from(vec);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }

  private projectToken(token: string, vec: Float64Array, weight: number) {
    const hash = crypto.createHash('sha256').update(token).digest();
    // Use 4 bytes at a time to generate deterministic pseudo-random projection indices
    for (let i = 0; i < 4; i++) {
      const idx = hash.readUInt16BE(i * 4) % this.dimension;
      const sign = (hash.readUInt8(i * 4 + 2) & 1) === 1 ? 1 : -1;
      vec[idx] += sign * weight;
    }
  }
}

/**
 * Google Gemini Embedding Provider (gemini-embedding-001 with 768 dimensions)
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini-embedding-001';
  dimension = 768;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedText(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: this.dimension,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini Embedding API Error: ${err}`);
    }

    const data = await res.json();
    return data.embedding.values;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }
}

/**
 * OpenAI Embedding Provider (text-embedding-3-small, 768 dimensions)
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai-text-embedding-3-small-768';
  dimension = 768;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedText(text: string): Promise<number[]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
        dimensions: this.dimension,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding API Error: ${err}`);
    }

    const data = await res.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts.map((t) => t.slice(0, 8000)),
        dimensions: this.dimension,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding API Error: ${err}`);
    }

    const data = await res.json();
    return data.data.map((item: any) => item.embedding);
  }
}

/**
 * Returns active embedding provider based on environment variables
 */
export function getActiveEmbeddingProvider(): EmbeddingProvider {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    return new GeminiEmbeddingProvider(geminiKey);
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return new OpenAIEmbeddingProvider(openaiKey);
  }

  // Default to our offline deterministic 768-d semantic provider
  return new DeterministicSemanticProvider();
}

/**
 * Computes SHA-256 hash of a text chunk for caching
 */
export function computeChunkHash(text: string): string {
  return crypto.createHash('sha256').update(text.trim()).digest('hex');
}
