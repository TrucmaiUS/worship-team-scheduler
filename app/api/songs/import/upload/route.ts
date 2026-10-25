import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { calculateFileHash, parseDocxBuffer } from '@/lib/parser/docx-parser';
import {
  annotateDuplicates,
  checkFileHashExists,
  findExistingSongsByTitles,
} from '@/lib/parser/duplicate-detector';

export async function POST(req: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const typesRaw = formData.get('types') as string | null;
    const defaultTypes = typesRaw
      ? typesRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : ['worship'];

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Invalid file format. Only .docx files are accepted.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = calculateFileHash(buffer);

    // 1. Check idempotency: Has this exact file been imported before?
    const isDuplicateFile = await checkFileHashExists(fileHash);

    // 2. Parse DOCX into structured songs (Auto-approval is disabled; always pending_review)
    const parsedSongs = await parseDocxBuffer(buffer, {
      defaultTypes,
    });

    if (parsedSongs.length === 0) {
      return NextResponse.json(
        { error: 'Could not detect any song structure in this document.' },
        { status: 422 }
      );
    }

    // 3. Annotate duplicates by checking canonical titles in the database
    const canonicalTitles = parsedSongs.map((s) => s.canonical_title);
    const existingSongs = await findExistingSongsByTitles(canonicalTitles);
    const annotatedSongs = annotateDuplicates(parsedSongs, existingSongs);

    // 4. Save preview record into document_imports
    const detectedCount = annotatedSongs.length;
    const duplicateCount = annotatedSongs.filter((s) =>
      s.warnings.some((w) => w.type === 'POTENTIAL_DUPLICATE_TITLE')
    ).length;
    const needsReviewCount = annotatedSongs.length; // All songs require human review

    const importRes = await db.query(
      `INSERT INTO document_imports 
        (file_name, file_hash, file_size, status, detected_count, duplicate_count, needs_review_count, raw_payload, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (file_hash) DO UPDATE SET
        status = 'parsed_preview',
        raw_payload = EXCLUDED.raw_payload,
        detected_count = EXCLUDED.detected_count,
        duplicate_count = EXCLUDED.duplicate_count,
        needs_review_count = EXCLUDED.needs_review_count
       RETURNING id`,
      [
        file.name,
        fileHash,
        file.size,
        'parsed_preview',
        detectedCount,
        duplicateCount,
        needsReviewCount,
        JSON.stringify(annotatedSongs),
        session.id,
      ]
    );

    const importId = importRes.rows[0].id;

    return NextResponse.json({
      success: true,
      import_id: importId,
      file_name: file.name,
      file_hash: fileHash,
      is_duplicate_file: isDuplicateFile,
      songs: annotatedSongs,
      summary: {
        total_detected: detectedCount,
        total_duplicates: duplicateCount,
        total_needs_review: needsReviewCount,
      },
    });
  } catch (err: any) {
    console.error('Error in docx upload API:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process DOCX file.' },
      { status: 500 }
    );
  }
}
