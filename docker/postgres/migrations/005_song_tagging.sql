-- ============================================================
-- Tag rehearsal content with a song ("Песня").
-- Lets recordings (audio_files), videos and multitrack groups be
-- associated with a song_texts entry, so the song page can show
-- every rehearsal take of that song.
-- NULL means "не привязано к песне".
-- ============================================================

ALTER TABLE "audio_files"
    ADD COLUMN IF NOT EXISTS "song_text_id" uuid REFERENCES song_texts(id) ON DELETE SET NULL;

ALTER TABLE "videos"
    ADD COLUMN IF NOT EXISTS "song_text_id" uuid REFERENCES song_texts(id) ON DELETE SET NULL;

ALTER TABLE "multitrack_groups"
    ADD COLUMN IF NOT EXISTS "song_text_id" uuid REFERENCES song_texts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audio_files_song_text_id_idx ON audio_files(song_text_id);
CREATE INDEX IF NOT EXISTS videos_song_text_id_idx ON videos(song_text_id);
CREATE INDEX IF NOT EXISTS multitrack_groups_song_text_id_idx ON multitrack_groups(song_text_id);
