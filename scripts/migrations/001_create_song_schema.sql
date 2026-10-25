-- Migration 001: Create Song Schema for Worship Team
-- Supports deterministic DOCX import, normalization, and preparation for AI ranking

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. document_imports: Track upload history, audit, and guarantee idempotency
CREATE TABLE IF NOT EXISTS document_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_hash VARCHAR(64) UNIQUE NOT NULL,
    file_size INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsing', 'parsed_preview', 'completed', 'failed')),
    detected_count INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    needs_review_count INTEGER DEFAULT 0,
    raw_payload JSONB,
    error_message TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_document_imports_file_hash ON document_imports(file_hash);
CREATE INDEX IF NOT EXISTS idx_document_imports_status ON document_imports(status);

-- 2. songs: Canonical identity of songs
CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_title TEXT NOT NULL,
    display_title TEXT NOT NULL,
    ministry_or_artist TEXT,
    approval_status VARCHAR(30) NOT NULL DEFAULT 'pending_review' CHECK (approval_status IN ('pending_review', 'approved', 'rejected')),
    import_id UUID REFERENCES document_imports(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_songs_canonical_title ON songs(canonical_title);
CREATE INDEX IF NOT EXISTS idx_songs_canonical_artist ON songs(canonical_title, ministry_or_artist);
CREATE INDEX IF NOT EXISTS idx_songs_approval_status ON songs(approval_status);

-- 3. song_versions: Multi-language / translations under the same canonical song
CREATE TABLE IF NOT EXISTS song_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'vi',
    version_title TEXT,
    translation_source TEXT,
    rights_status TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_song_versions_song_id ON song_versions(song_id);

-- 4. song_sections: Ordered structural segments of lyrics
CREATE TABLE IF NOT EXISTS song_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES song_versions(id) ON DELETE CASCADE,
    section_type VARCHAR(20) NOT NULL CHECK (section_type IN ('intro', 'verse', 'pre_chorus', 'chorus', 'bridge', 'tag', 'outro', 'other')),
    section_label TEXT NOT NULL,
    section_order INTEGER NOT NULL,
    lyrics_text TEXT NOT NULL,
    CONSTRAINT uq_version_section_order UNIQUE (version_id, section_order)
);

CREATE INDEX IF NOT EXISTS idx_song_sections_version_id ON song_sections(version_id);

-- 5. themes: Canonical theological themes
CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_themes_slug ON themes(slug);

-- 6. song_themes: Many-to-many relationship separating manual vs AI-inferred metadata
CREATE TABLE IF NOT EXISTS song_themes (
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_suggested')),
    confidence_score NUMERIC(3, 2),
    verified_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (song_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_song_themes_theme_id ON song_themes(theme_id);
