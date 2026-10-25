import mammoth from 'mammoth';
import crypto from 'crypto';
import {
  ParsedSection,
  ParsedSong,
  ParseOptions,
  SongWarning,
} from './types';
import {
  cleanSectionLabel,
  detectSectionType,
  normalizeCanonicalTitle,
} from './normalizer';
import { determineApprovalStatus } from './approval-policy';

/**
 * Calculates SHA-256 hash of a file buffer for idempotency and duplicate checking.
 */
export function calculateFileHash(buffer: Buffer | ArrayBuffer): string {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return crypto.createHash('sha256').update(nodeBuffer).digest('hex');
}

/**
 * Checks if a line is a song separator.
 * Matches: '----', '====', form feeds, or lines with only dashes/equals.
 */
function isSongSeparator(line: string): boolean {
  const trimmed = line.trim();
  return /^[-=]{3,}$/.test(trimmed) || trimmed === '\f';
}

/**
 * Checks if a line matches a section header pattern.
 * E.g., [Verse], ***[Verse 1]***, **[Chorus]**, [Bridge], Điệp khúc, Lời 1, etc.
 */
function isSectionHeaderLine(line: string): boolean {
  const cleaned = cleanSectionLabel(line.trim());
  if (!cleaned) return false;

  // Bracketed pattern: [Verse], [Chorus 1], etc.
  if (/^\[[^\]]+\]$/.test(cleaned)) {
    return true;
  }

  // Common keywords even without brackets
  const lower = cleaned.toLowerCase();
  return /^(verse(?:\s*\d+)?|lời(?:\s*\d+)?|đoạn(?:\s*\d+)?|chorus(?:\s*\d+)?|điệp\s*khúc(?:\s*\d+)?|đk(?:\s*\d+)?|bridge(?:\s*\d+)?|pre-?chorus(?:\s*\d+)?|tag(?:\s*\d+)?|intro|outro|kết)$/i.test(lower);
}

/**
 * Parses raw text into one or more ParsedSong records using a deterministic state machine.
 */
export function parseSongText(rawText: string, options?: ParseOptions): ParsedSong[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  // 1. Split into song blocks based on separators or page breaks
  const rawLines = rawText.split(/\r?\n/);
  const songBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of rawLines) {
    if (isSongSeparator(line)) {
      if (currentBlock.length > 0) {
        songBlocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    songBlocks.push(currentBlock);
  }

  const results: ParsedSong[] = [];
  const defaultTypes = (options?.defaultTypes && options.defaultTypes.length > 0)
    ? options.defaultTypes
    : ['worship'];

  // 2. Parse each song block
  for (const block of songBlocks) {
    const trimmedLines = block.map(l => l.trimEnd());
    // Strip leading empty lines
    while (trimmedLines.length > 0 && !trimmedLines[0].trim()) {
      trimmedLines.shift();
    }
    // Strip trailing empty lines
    while (trimmedLines.length > 0 && !trimmedLines[trimmedLines.length - 1].trim()) {
      trimmedLines.pop();
    }

    if (trimmedLines.length === 0) continue;

    const warnings: SongWarning[] = [];
    let display_title = '';
    let ministry_or_artist: string | null = null;
    const sections: ParsedSection[] = [];

    let lineIdx = 0;

    // Line 0 is always the Title
    display_title = trimmedLines[lineIdx].trim().replace(/^\*+|\*+$/g, '');
    lineIdx++;

    // Skip empty lines between Title and Artist/Section
    while (lineIdx < trimmedLines.length && !trimmedLines[lineIdx].trim()) {
      lineIdx++;
    }

    // Check if next non-empty line is Artist or a Section Header
    if (lineIdx < trimmedLines.length) {
      const candidateArtistOrHeader = trimmedLines[lineIdx];
      if (isSectionHeaderLine(candidateArtistOrHeader)) {
        // Missing artist! Transition directly to sections
        ministry_or_artist = null;
        warnings.push({
          type: 'MISSING_ARTIST',
          message: 'Artist or ministry information was not found in the document.',
        });
      } else {
        // Found artist
        ministry_or_artist = candidateArtistOrHeader.trim().replace(/^\*+|\*+$/g, '') || null;
        lineIdx++;
      }
    } else {
      ministry_or_artist = null;
      warnings.push({
        type: 'MISSING_ARTIST',
        message: 'Artist or ministry information was not found in the document.',
      });
    }

    // Now collect sections
    let currentSectionType: any = null;
    let currentSectionLabel = '';
    let currentSectionOrder = 1;
    let currentLyricsLines: string[] = [];
    let isCurrentRecognized = true;

    function commitCurrentSection() {
      if (currentSectionLabel && currentLyricsLines.length > 0) {
        const lyricsText = currentLyricsLines.join('\n').trim();
        if (lyricsText) {
          sections.push({
            section_type: currentSectionType,
            section_label: currentSectionLabel,
            section_order: currentSectionOrder++,
            lyrics_text: lyricsText,
            is_recognized: isCurrentRecognized,
          });
        }
      }
      currentLyricsLines = [];
    }

    while (lineIdx < trimmedLines.length) {
      const line = trimmedLines[lineIdx];
      const trimmed = line.trim();

      if (isSectionHeaderLine(trimmed)) {
        commitCurrentSection();

        const cleanLabel = cleanSectionLabel(trimmed);
        const { section_type, is_recognized } = detectSectionType(cleanLabel);

        currentSectionLabel = cleanLabel;
        currentSectionType = section_type;
        isCurrentRecognized = is_recognized;

        if (!is_recognized) {
          warnings.push({
            type: 'UNRECOGNIZED_SECTION',
            message: `Section label '${cleanLabel}' is not in the standardized classification.`,
          });
        }
      } else if (trimmed) {
        if (!currentSectionLabel) {
          currentSectionLabel = 'Other';
          currentSectionType = 'other';
          isCurrentRecognized = false;
          warnings.push({
            type: 'UNRECOGNIZED_SECTION',
            message: `Lyrics found before any section header.`,
          });
        }
        currentLyricsLines.push(line);
      } else {
        if (currentLyricsLines.length > 0) {
          currentLyricsLines.push('');
        }
      }
      lineIdx++;
    }

    // Commit final section
    commitCurrentSection();

    // Structural validations
    let isValid = true;
    if (!display_title) {
      isValid = false;
      warnings.push({
        type: 'STRUCTURAL_ANOMALY',
        message: 'Song title is missing.',
      });
    }

    if (sections.length === 0) {
      isValid = false;
      warnings.push({
        type: 'MISSING_LYRICS',
        message: 'No lyrics sections were detected.',
      });
    }

    const canonical_title = normalizeCanonicalTitle(display_title);

    const songWithoutStatus = {
      display_title,
      canonical_title,
      ministry_or_artist,
      types: defaultTypes,
      song_type: defaultTypes[0] || 'worship',
      language: 'vi',
      sections,
      warnings,
      is_valid: isValid,
    };

    const approval_status = determineApprovalStatus(songWithoutStatus);

    results.push({
      ...songWithoutStatus,
      approval_status,
    });
  }

  return results;
}

/**
 * Reads a DOCX file buffer and parses all contained songs.
 */
export async function parseDocxBuffer(
  buffer: Buffer | ArrayBuffer,
  options?: ParseOptions
): Promise<ParsedSong[]> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const { value: rawText } = await mammoth.extractRawText({ buffer: nodeBuffer });
  return parseSongText(rawText, options);
}
