-- ============================================================
-- Chords layer for comments.
-- Stores an array of { chord_id, position } where position is the
-- 0-based character index into the comment content (same model as
-- song_text_chords). NULL means "no chords" (plain comment).
-- Chord details are resolved on the client from the chord library.
-- Not applied to photo comments (enforced in the API).
-- ============================================================

ALTER TABLE "comments"
    ADD COLUMN IF NOT EXISTS "chords" jsonb;

ALTER TABLE "multitrack_comments"
    ADD COLUMN IF NOT EXISTS "chords" jsonb;
