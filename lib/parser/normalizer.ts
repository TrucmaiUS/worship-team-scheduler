import { SectionType } from './types';

/**
 * Normalizes title for deduplication and indexing:
 * - Decomposes diacritics / Vietnamese accents
 * - Converts to lowercase
 * - Strips all non-alphanumeric characters (except spaces)
 * - Collapses multiple spaces and trims
 */
export function normalizeCanonicalTitle(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans section label by removing markdown markers like **, ***, [, ]
 */
export function cleanSectionLabel(rawLabel: string): string {
  return rawLabel
    .replace(/^\*+|\*+$/g, '')
    .trim();
}

/**
 * Detects section_type from section header label.
 * Returns the standardized type and a flag indicating if it was recognized.
 */
export function detectSectionType(rawLabel: string): {
  section_type: SectionType;
  is_recognized: boolean;
} {
  const cleaned = cleanSectionLabel(rawLabel);
  // Strip enclosing brackets for regex checking: [Verse 1] -> Verse 1
  const inner = cleaned.replace(/^\[\s*|\s*\]$/g, '').trim();

  // 1. Verse / Lời / Đoạn (supports numbers and Roman numerals like [Verse I], [Verse II])
  if (/^(verse(?:\s*(?:\d+|[ivx]+))?|lời(?:\s*(?:\d+|[ivx]+))?|đoạn(?:\s*(?:\d+|[ivx]+))?|v\d+)$/i.test(inner)) {
    return { section_type: 'verse', is_recognized: true };
  }

  // 2. Pre-Chorus / Tiền điệp khúc
  if (/^(pre-?chorus(?:\s*(?:\d+|[ivx]+))?|tiền\s*điệp\s*khúc)$/i.test(inner)) {
    return { section_type: 'pre_chorus', is_recognized: true };
  }

  // 3. Chorus / Điệp khúc / ĐK
  if (/^(chorus(?:\s*(?:\d+|[ivx]+))?|điệp\s*khúc(?:\s*(?:\d+|[ivx]+))?|đk(?:\s*(?:\d+|[ivx]+))?)$/i.test(inner)) {
    return { section_type: 'chorus', is_recognized: true };
  }

  // 4. Bridge / Nhịp cầu / Điệp khúc nối
  if (/^(bridge(?:\s*(?:\d+|[ivx]+))?|nhịp\s*cầu|đoạn\s*nối|cầu\s*nối)$/i.test(inner)) {
    return { section_type: 'bridge', is_recognized: true };
  }

  // 5. Tag
  if (/^tag(?:\s*\d+)?$/i.test(inner)) {
    return { section_type: 'tag', is_recognized: true };
  }

  // 6. Intro
  if (/^intro$/i.test(inner)) {
    return { section_type: 'intro', is_recognized: true };
  }

  // 7. Outro / Kết thúc
  if (/^(outro|kết(?:\s*thúc)?)$/i.test(inner)) {
    return { section_type: 'outro', is_recognized: true };
  }

  // Unrecognized section
  return { section_type: 'other', is_recognized: false };
}
