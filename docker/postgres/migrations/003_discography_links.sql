-- ============================================================
-- Per-release streaming/platform links for discography items
-- ============================================================

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
