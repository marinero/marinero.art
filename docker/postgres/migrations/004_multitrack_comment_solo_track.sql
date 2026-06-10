-- ============================================================
-- Optional per-comment track selection for multitrack comments.
-- When set, jumping to the comment timecode puts this track into SOLO.
-- NULL means "все треки" (no solo applied).
-- ============================================================

ALTER TABLE "multitrack_comments"
    ADD COLUMN IF NOT EXISTS "solo_track_id" uuid REFERENCES multitrack_files(id) ON DELETE SET NULL;
