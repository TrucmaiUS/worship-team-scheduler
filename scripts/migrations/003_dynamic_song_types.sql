-- Migration 003: Dynamic Song Types and Tag-based system

-- 1. Create table for dynamic song types
CREATE TABLE IF NOT EXISTS song_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(30) DEFAULT 'blue',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial standard worship ministry types
INSERT INTO song_types (name, slug, color) VALUES
    ('Praise', 'praise', 'pink'),
    ('Worship', 'worship', 'blue'),
    ('Hymn', 'hymn', 'purple'),
    ('Response', 'response', 'green')
ON CONFLICT (slug) DO NOTHING;

-- 2. Modify songs table to support flexible array of type tags
ALTER TABLE songs DROP CONSTRAINT IF EXISTS songs_song_type_check;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS types TEXT[] DEFAULT ARRAY['worship'];

-- Ensure existing rows have types populated from song_type
UPDATE songs 
SET types = ARRAY[COALESCE(song_type, 'worship')]
WHERE types IS NULL OR types = '{}';

CREATE INDEX IF NOT EXISTS idx_songs_types ON songs USING GIN (types);
