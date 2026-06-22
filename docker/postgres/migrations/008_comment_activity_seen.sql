ALTER TABLE "profiles"
    ADD COLUMN IF NOT EXISTS "comment_activity_seen_at" timestamp with time zone;
