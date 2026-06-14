-- Align audio_files with rehearsal recordings schema (rehearsal_id + filename).
-- Safe to re-run.

ALTER TABLE "audio_files" ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "audio_files"
    ADD COLUMN IF NOT EXISTS "rehearsal_id" uuid REFERENCES rehearsals(id) ON DELETE CASCADE;

ALTER TABLE "audio_files"
    ADD COLUMN IF NOT EXISTS "filename" text;
