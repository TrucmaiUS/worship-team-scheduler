import { normalizeForComparison, normalizeWhitespace, tokenizeWords } from './normalization';
import { EvidenceStatus, RelevanceScore } from './types';

export interface EvidenceQuoteResult {
  quote: string;
  normalizedQuote: string;
  isSubstring: boolean;
  isMeaningful: boolean;
}

export interface EvidenceValidationResult {
  required: boolean;
  status: EvidenceStatus;
  allQuotesAreSubstrings: boolean;
  allQuotesAreMeaningful: boolean;
  quoteResults: EvidenceQuoteResult[];
  reasons: string[];
}

function isMeaningfulQuote(quote: string): boolean {
  const normalized = normalizeWhitespace(quote);
  return normalized.length >= 6 && tokenizeWords(normalized).length >= 2;
}

export function validateEvidence(
  lyrics: string,
  evidenceQuotes: readonly string[],
  relevanceScore: RelevanceScore
): EvidenceValidationResult {
  const normalizedLyrics = normalizeForComparison(lyrics);
  if (!normalizedLyrics) throw new Error('Lyrics must not be empty.');

  const required = relevanceScore >= 2;
  const quoteResults = evidenceQuotes.map((quote) => {
    const normalizedQuote = normalizeForComparison(quote);
    return {
      quote,
      normalizedQuote,
      isSubstring: normalizedQuote.length > 0 && normalizedLyrics.includes(normalizedQuote),
      isMeaningful: isMeaningfulQuote(quote),
    };
  });

  const allQuotesAreSubstrings = quoteResults.every((item) => item.isSubstring);
  const allQuotesAreMeaningful = quoteResults.every((item) => item.isMeaningful);
  const reasons: string[] = [];

  if (required && quoteResults.length === 0) reasons.push('required_evidence_missing');
  if (!allQuotesAreSubstrings) reasons.push('evidence_not_verbatim_substring');
  if (!allQuotesAreMeaningful) reasons.push('evidence_too_short_or_generic');

  let status: EvidenceStatus;
  if (reasons.length > 0) {
    status = 'invalid';
  } else if (!required && quoteResults.length === 0) {
    status = 'not_required';
  } else {
    status = 'valid';
  }

  return {
    required,
    status,
    allQuotesAreSubstrings,
    allQuotesAreMeaningful,
    quoteResults,
    reasons,
  };
}
