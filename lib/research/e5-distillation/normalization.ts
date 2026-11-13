export function normalizeWhitespace(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase('und');
}

export function tokenizeWords(value: string): string[] {
  const normalized = normalizeForComparison(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return normalized ? normalized.split(' ') : [];
}

function jaccardFromSets(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) intersection += 1;
  }

  return intersection / (left.size + right.size - intersection);
}

export function wordJaccard(left: string, right: string): number {
  return jaccardFromSets(new Set(tokenizeWords(left)), new Set(tokenizeWords(right)));
}

export function characterNgrams(value: string, n = 3): Set<string> {
  const normalized = normalizeForComparison(value).replace(/\s+/gu, ' ');
  if (!normalized) return new Set();
  if (normalized.length <= n) return new Set([normalized]);

  const grams = new Set<string>();
  for (let index = 0; index <= normalized.length - n; index += 1) {
    grams.add(normalized.slice(index, index + n));
  }
  return grams;
}

export function charNgramJaccard(left: string, right: string, n = 3): number {
  return jaccardFromSets(characterNgrams(left, n), characterNgrams(right, n));
}

export function levenshteinDistance(left: string, right: string): number {
  const a = Array.from(normalizeForComparison(left));
  const b = Array.from(normalizeForComparison(right));

  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = new Array<number>(b.length + 1);
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + substitutionCost
      );
    }

    previous = current;
  }

  return previous[b.length];
}

export function normalizedLevenshteinDistance(left: string, right: string): number {
  const normalizedLeft = normalizeForComparison(left);
  const normalizedRight = normalizeForComparison(right);
  const maxLength = Math.max(
    Array.from(normalizedLeft).length,
    Array.from(normalizedRight).length
  );

  if (maxLength === 0) return 0;
  return levenshteinDistance(normalizedLeft, normalizedRight) / maxLength;
}
