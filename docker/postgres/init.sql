-- ============================================================
-- NextAuth users table (replaces Supabase auth.users)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "users" (
    "id"                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "email"             text NOT NULL UNIQUE,
    "password_hash"     text,                          -- bcrypt, nullable for OAuth
    "email_verified"    boolean DEFAULT false,
    "verification_token" text,
    "reset_token"       text,
    "reset_token_expires" timestamp with time zone,
    "created_at"        timestamp with time zone DEFAULT now(),
    "updated_at"        timestamp with time zone DEFAULT now()
);

-- NextAuth sessions
CREATE TABLE IF NOT EXISTS "sessions" (
    "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id"     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "token"       text NOT NULL UNIQUE,
    "expires_at"  timestamp with time zone NOT NULL,
    "created_at"  timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- ============================================================
-- Public schema tables (same as Supabase, without Supabase deps)
-- ============================================================

CREATE TABLE IF NOT EXISTS "profiles" (
    "id"           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    "username"     text,
    "display_name" text,
    "avatar_url"   text,
    "role"         text DEFAULT 'fan' CHECK (role IN ('fan', 'admin')),
    "created_at"   timestamp with time zone DEFAULT now(),
    "updated_at"   timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "events" (
    "id"              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "title"           text NOT NULL,
    "slug"            text NOT NULL UNIQUE,
    "description"     text,
    "venue"           text,
    "city"            text,
    "event_date"      timestamp with time zone NOT NULL,
    "doors_time"      text,
    "venue_address"   text,
    "google_maps_url" text,
    "how_to_get"      text,
    "entry_rules"     text,
    "contacts"        text,
    "ticket_url"      text,
    "image_url"       text,
    "is_published"    boolean DEFAULT false,
    "created_at"      timestamp with time zone DEFAULT now(),
    "updated_at"      timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "albums" (
    "id"              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "title"           text NOT NULL,
    "slug"            text NOT NULL UNIQUE,
    "description"     text,
    "cover_image_url" text,
    "event_date"      timestamp with time zone,
    "is_published"    boolean DEFAULT false,
    "created_at"      timestamp with time zone DEFAULT now(),
    "updated_at"      timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "photos" (
    "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "album_id"      uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    "url"           text NOT NULL,
    "thumbnail_url" text,
    "caption"       text,
    "order_index"   integer DEFAULT 0,
    "created_at"    timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "videos" (
    "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "title"            text NOT NULL,
    "slug"             text UNIQUE,
    "description"      text,
    "video_url"        text NOT NULL,
    "video_type"       text DEFAULT 'youtube' CHECK (video_type IN ('youtube', 'vk', 'rutube', 'custom')),
    "thumbnail_url"    text,
    "duration_seconds" integer,
    "is_published"     boolean DEFAULT false,
    "order_index"      integer DEFAULT 0,
    "created_at"       timestamp with time zone DEFAULT now(),
    "updated_at"       timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rehearsals" (
    "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "rehearsal_date" date NOT NULL,
    "created_at"     timestamp with time zone DEFAULT now(),
    "updated_at"     timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "multitrack_groups" (
    "id"           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "rehearsal_id" uuid NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
    "name"         text NOT NULL,
    "created_at"   timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "multitrack_files" (
    "id"                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "multitrack_group_id"  uuid NOT NULL REFERENCES multitrack_groups(id) ON DELETE CASCADE,
    "filename"             text NOT NULL,
    "file_url"             text NOT NULL,
    "duration_seconds"     numeric,
    "waveform_data"        jsonb,
    "volume"               integer DEFAULT 80,
    "order_index"          integer DEFAULT 0,
    "created_at"           timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "audio_files" (
    "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "rehearsal_id"     uuid NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
    "file_url"         text NOT NULL,
    "filename"         text NOT NULL,
    "duration_seconds" numeric,
    "created_at"       timestamp with time zone DEFAULT now(),
    -- legacy columns kept for compatibility with older dumps
    "title"            text,
    "slug"             text UNIQUE,
    "is_published"     boolean DEFAULT false,
    "order_index"      integer DEFAULT 0,
    "updated_at"       timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "platform_links" (
    "id"          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "platform"    text NOT NULL,
    "url"         text NOT NULL,
    "icon"        text,
    "order_index" integer DEFAULT 0,
    "is_active"   boolean DEFAULT true,
    "created_at"  timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chords" (
    "id"               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "name"             text NOT NULL,
    "root_note"        text NOT NULL,
    "chord_type"       text NOT NULL,
    "fret_positions"   jsonb NOT NULL,
    "finger_positions" jsonb,
    "base_fret"        integer DEFAULT 1,
    "created_at"       timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "song_texts" (
    "id"           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "title"        text NOT NULL,
    "slug"         text NOT NULL UNIQUE,
    "text_content" text NOT NULL,
    "bpm"          integer,
    "is_published" boolean DEFAULT false,
    "created_by"   uuid REFERENCES users(id),
    "created_at"   timestamp with time zone DEFAULT now(),
    "updated_at"   timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "song_text_chords" (
    "id"           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "song_text_id" uuid NOT NULL REFERENCES song_texts(id) ON DELETE CASCADE,
    "chord_id"     uuid NOT NULL REFERENCES chords(id),
    "position"     integer NOT NULL,
    "created_at"   timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "comments" (
    "id"                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "type"              text NOT NULL CHECK (type IN ('audio','photo','rehearsal','event','song','video')),
    "object_id"         uuid NOT NULL,
    "user_id"           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "content"           text NOT NULL,
    "parent_id"         uuid REFERENCES comments(id),
    "timestamp_seconds" numeric,
    "created_at"        timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "multitrack_comments" (
    "id"                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "multitrack_group_id"  uuid NOT NULL REFERENCES multitrack_groups(id) ON DELETE CASCADE,
    "user_id"              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "content"              text NOT NULL,
    "timestamp_seconds"    numeric,
    "solo_track_id"        uuid REFERENCES multitrack_files(id) ON DELETE SET NULL,
    "parent_id"            uuid REFERENCES multitrack_comments(id),
    "created_at"           timestamp with time zone DEFAULT now(),
    "updated_at"           timestamp with time zone DEFAULT now()
);

-- Junction tables
CREATE TABLE IF NOT EXISTS "event_albums" (
    "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "event_id"      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    "album_id"      uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    "display_order" integer DEFAULT 0,
    "created_at"    timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "event_videos" (
    "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "event_id"      uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    "video_id"      uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    "display_order" integer DEFAULT 0,
    "created_at"    timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "rehearsal_videos" (
    "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "rehearsal_id"  uuid NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
    "video_id"      uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    "display_order" integer DEFAULT 0,
    "created_at"    timestamp with time zone DEFAULT now()
);

-- ============================================================
-- "О нас" (About) section
-- ============================================================
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

CREATE TABLE IF NOT EXISTS "discography_links" (
    "id"             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "discography_id" uuid NOT NULL REFERENCES discography(id) ON DELETE CASCADE,
    "platform"       text NOT NULL,
    "url"            text NOT NULL,
    "icon"           text,
    "order_index"    integer DEFAULT 0,
    "created_at"     timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discography_links_discography_id_idx
    ON discography_links(discography_id);

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

-- ============================================================
-- Song tagging: associate rehearsal content with a song.
-- (defined here because song_texts must exist first)
-- ============================================================
ALTER TABLE "audio_files"
    ADD COLUMN IF NOT EXISTS "song_text_id" uuid REFERENCES song_texts(id) ON DELETE SET NULL;
ALTER TABLE "videos"
    ADD COLUMN IF NOT EXISTS "song_text_id" uuid REFERENCES song_texts(id) ON DELETE SET NULL;
ALTER TABLE "multitrack_groups"
    ADD COLUMN IF NOT EXISTS "song_text_id" uuid REFERENCES song_texts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audio_files_song_text_id_idx ON audio_files(song_text_id);
CREATE INDEX IF NOT EXISTS videos_song_text_id_idx ON videos(song_text_id);
CREATE INDEX IF NOT EXISTS multitrack_groups_song_text_id_idx ON multitrack_groups(song_text_id);
