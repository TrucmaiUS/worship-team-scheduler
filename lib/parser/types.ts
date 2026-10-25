import { z } from 'zod';

export const SectionTypeSchema = z.enum([
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'bridge',
  'tag',
  'outro',
  'other',
]);

export type SectionType = z.infer<typeof SectionTypeSchema>;

export const ParsedSectionSchema = z.object({
  section_type: SectionTypeSchema,
  section_label: z.string().min(1),
  section_order: z.number().int().positive(),
  lyrics_text: z.string().min(1),
  is_recognized: z.boolean().default(true),
});

export type ParsedSection = z.infer<typeof ParsedSectionSchema>;

export const SongWarningTypeSchema = z.enum([
  'MISSING_ARTIST',
  'UNRECOGNIZED_SECTION',
  'POTENTIAL_DUPLICATE_TITLE',
  'EXACT_DUPLICATE_FILE',
  'STRUCTURAL_ANOMALY',
  'MISSING_LYRICS',
]);

export type SongWarningType = z.infer<typeof SongWarningTypeSchema>;

export interface SongWarning {
  type: SongWarningType;
  message: string;
}

export const ApprovalStatusSchema = z.enum(['pending_review', 'approved', 'rejected']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ParsedSongSchema = z.object({
  display_title: z.string().min(1, 'Title cannot be empty'),
  canonical_title: z.string().min(1),
  ministry_or_artist: z.string().nullable(),
  types: z.array(z.string()).default(['worship']),
  song_type: z.string().default('worship'),
  approval_status: ApprovalStatusSchema.default('pending_review'),
  language: z.string().default('vi'),
  sections: z.array(ParsedSectionSchema).min(1, 'A song must have at least one section'),
  warnings: z.array(z.object({
    type: SongWarningTypeSchema,
    message: z.string(),
  })).default([]),
  is_valid: z.boolean().default(true),
});

export type ParsedSong = z.infer<typeof ParsedSongSchema>;

export interface ParseOptions {
  defaultTypes?: string[];
}

export interface DocumentParseResult {
  file_name: string;
  file_hash: string;
  is_duplicate_file: boolean;
  songs: ParsedSong[];
  total_detected: number;
  total_valid: number;
  total_with_warnings: number;
  total_pending_review: number;
}
