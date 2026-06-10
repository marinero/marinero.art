import { db } from '@/lib/db'

type LinkInput = { platform?: string; url?: string; icon?: string | null }

export async function replaceDiscographyLinks(
  discographyId: string,
  links: LinkInput[]
) {
  await db.query('DELETE FROM discography_links WHERE discography_id = $1', [
    discographyId,
  ])

  const valid = links.filter(
    (l) =>
      l &&
      typeof l.platform === 'string' &&
      l.platform.trim() &&
      typeof l.url === 'string' &&
      l.url.trim()
  )

  for (let i = 0; i < valid.length; i++) {
    const link = valid[i]
    await db.query(
      `INSERT INTO discography_links (discography_id, platform, url, icon, order_index)
       VALUES ($1, $2, $3, $4, $5)`,
      [discographyId, link.platform!.trim(), link.url!.trim(), link.icon ?? null, i]
    )
  }
}
