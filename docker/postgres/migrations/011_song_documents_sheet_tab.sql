-- ============================================================
-- Добавляем тип документа "Ноты + Табы" (sheet_tab) — для файлов,
-- где ноты и табулатура идут вместе.
-- ============================================================

ALTER TABLE "song_documents" DROP CONSTRAINT IF EXISTS "song_documents_kind_check";

ALTER TABLE "song_documents"
    ADD CONSTRAINT "song_documents_kind_check"
    CHECK (kind IN ('sheet', 'tab', 'sheet_tab', 'other'));
