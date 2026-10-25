-- Migration 004: Enable Vector & Full-Text Search Extensions and Tables
-- Supports Phase 3: Baseline 1 (Keyword), Baseline 2 (Semantic Vector), Baseline 3 (Hybrid RRF)

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrapper for unaccent to allow GIN indexing in PostgreSQL
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text AS
$func$
SELECT public.unaccent('public.unaccent', $1)
$func$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 1. Table for isolated, swappable vector embeddings
CREATE TABLE IF NOT EXISTS song_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('song', 'section')),
    song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    section_id UUID REFERENCES song_sections(id) ON DELETE CASCADE,
    model_name VARCHAR(50) NOT NULL,
    dimension INTEGER NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_song_embeddings_song_id ON song_embeddings(song_id);
CREATE INDEX IF NOT EXISTS idx_song_embeddings_model ON song_embeddings(model_name);
CREATE INDEX IF NOT EXISTS idx_song_embeddings_hash ON song_embeddings(content_hash);

-- 2. Full-Text Search Indexes using 'simple' dictionary with immutable_unaccent
CREATE INDEX IF NOT EXISTS idx_songs_fts ON songs USING GIN (
    to_tsvector('simple', immutable_unaccent(display_title || ' ' || COALESCE(ministry_or_artist, '')))
);

CREATE INDEX IF NOT EXISTS idx_song_sections_fts ON song_sections USING GIN (
    to_tsvector('simple', immutable_unaccent(lyrics_text))
);
