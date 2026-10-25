-- Migration 002: Add song_type (praise / worship) to songs table

ALTER TABLE songs 
ADD COLUMN IF NOT EXISTS song_type VARCHAR(20) DEFAULT 'worship' CHECK (song_type IN ('praise', 'worship'));

CREATE INDEX IF NOT EXISTS idx_songs_song_type ON songs(song_type);
