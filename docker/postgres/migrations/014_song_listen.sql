-- ============================================================
-- Публичная запись песни (S3) + ссылки на стриминговые площадки.
-- Файл играет в своём плеере на странице песни для всех посетителей.
-- ============================================================

ALTER TABLE "song_texts"
    ADD COLUMN IF NOT EXISTS "audio_url" text;

ALTER TABLE "song_texts"
    ADD COLUMN IF NOT EXISTS "audio_filename" text;

CREATE TABLE IF NOT EXISTS "song_links" (
    "id"           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "song_text_id" uuid NOT NULL REFERENCES song_texts(id) ON DELETE CASCADE,
    "platform"     text NOT NULL,
    "url"          text NOT NULL,
    "icon"         text,
    "order_index"  integer DEFAULT 0,
    "created_at"   timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS song_links_song_text_id_idx
    ON song_links(song_text_id);
