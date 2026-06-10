-- ============================================================
-- "О нас" (About) section: description, discography, members, timeline
-- ============================================================

-- Single-row editable description block
CREATE TABLE IF NOT EXISTS "about_content" (
    "id"         integer PRIMARY KEY DEFAULT 1,
    "title"      text,
    "body"       text,
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT about_content_singleton CHECK (id = 1)
);

INSERT INTO "about_content" (id, title, body)
VALUES (1, 'О нас', '')
ON CONFLICT (id) DO NOTHING;

-- Discography (music releases)
CREATE TABLE IF NOT EXISTS "discography" (
    "id"              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "title"           text NOT NULL,
    "year"            integer,
    "release_type"    text DEFAULT 'album' CHECK (release_type IN ('album','ep','single','live','compilation')),
    "cover_image_url" text,
    "description"     text,
    "order_index"     integer DEFAULT 0,
    "is_published"    boolean DEFAULT true,
    "created_at"      timestamp with time zone DEFAULT now(),
    "updated_at"      timestamp with time zone DEFAULT now()
);

-- Band members (current and former)
CREATE TABLE IF NOT EXISTS "band_members" (
    "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "name"        text NOT NULL,
    "photo_url"   text,
    "instruments" text,
    "bio"         text,
    "is_current"  boolean DEFAULT true,
    "order_index" integer DEFAULT 0,
    "created_at"  timestamp with time zone DEFAULT now(),
    "updated_at"  timestamp with time zone DEFAULT now()
);

-- Timeline segments for the Gantt chart (one row per instrument-period)
CREATE TABLE IF NOT EXISTS "member_timeline" (
    "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "member_id"   uuid NOT NULL REFERENCES band_members(id) ON DELETE CASCADE,
    "role"        text NOT NULL,
    "start_year"  integer NOT NULL,
    "end_year"    integer,
    "order_index" integer DEFAULT 0,
    "created_at"  timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_timeline_member_id_idx ON member_timeline(member_id);
