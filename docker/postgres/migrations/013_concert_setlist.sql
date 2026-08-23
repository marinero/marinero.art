-- ============================================================
-- Сетлист концерта + техническая метаинформация песни
-- (только для админов). BPM может быть диапазоном («115/120»).
-- ============================================================

ALTER TABLE "song_texts"
    ALTER COLUMN "bpm" TYPE text USING bpm::text;

ALTER TABLE "song_texts"
    ADD COLUMN IF NOT EXISTS "tech_meta" jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS "event_songs" (
    "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "event_id"      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    "song_text_id"  uuid NOT NULL REFERENCES song_texts(id) ON DELETE CASCADE,
    "display_order" integer NOT NULL DEFAULT 0,
    "created_at"    timestamp with time zone DEFAULT now(),
    UNIQUE ("event_id", "song_text_id")
);

CREATE INDEX IF NOT EXISTS event_songs_event_id_idx
    ON event_songs (event_id, display_order);
