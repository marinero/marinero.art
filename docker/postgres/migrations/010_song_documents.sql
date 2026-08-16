-- ============================================================
-- Documents attached to a song ("Ноты" / "Табы" и прочие файлы).
-- Позволяет загружать PDF/картинки/табы и привязывать их к песне.
-- Каждый документ можно опубликовать или скрыть по отдельности
-- (is_published), независимо от статуса самой песни.
-- Файлы хранятся в приватном бакете (marinero/documents/...) и
-- отдаются через /api/documents/[id] с проверкой прав.
-- ============================================================

CREATE TABLE IF NOT EXISTS "song_documents" (
    "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "song_text_id"  uuid NOT NULL REFERENCES song_texts(id) ON DELETE CASCADE,
    "title"         text NOT NULL,
    "kind"          text NOT NULL DEFAULT 'sheet' CHECK (kind IN ('sheet', 'tab', 'other')),
    "file_url"      text NOT NULL,
    "filename"      text NOT NULL,
    "content_type"  text,
    "size_bytes"    bigint,
    "is_published"  boolean NOT NULL DEFAULT false,
    "order_index"   integer NOT NULL DEFAULT 0,
    "created_at"    timestamp with time zone DEFAULT now(),
    "updated_at"    timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS song_documents_song_text_id_idx ON song_documents(song_text_id);
CREATE INDEX IF NOT EXISTS song_documents_published_idx ON song_documents(song_text_id, is_published);
