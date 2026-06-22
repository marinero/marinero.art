-- Site-wide settings (not tied to user profiles)
CREATE TABLE IF NOT EXISTS "site_settings" (
    "key"        text PRIMARY KEY,
    "value"      jsonb NOT NULL DEFAULT '{}',
    "updated_at" timestamp with time zone DEFAULT now()
);

INSERT INTO "site_settings" ("key", "value")
VALUES ('notifications', '{"mention_email_enabled": true}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
