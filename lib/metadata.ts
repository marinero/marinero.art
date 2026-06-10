import type { Metadata } from 'next'

export const SITE_TITLE = 'Официальный сайт рок-группы MARINERO'

const SEPARATOR = ' - '

/**
 * Join the site title with contextual section/subsection/object segments, e.g.
 * buildTitle('Тексты песен', '"Не забудьте про любовь"') ->
 * 'Официальный сайт рок-группы MARINERO - Тексты песен - "Не забудьте про любовь"'
 */
export function buildTitle(...segments: Array<string | null | undefined>): string {
  const parts = segments
    .map((segment) => (typeof segment === 'string' ? segment.trim() : ''))
    .filter((segment) => segment.length > 0)

  return [SITE_TITLE, ...parts].join(SEPARATOR)
}

interface PageMetadataOptions {
  /** Section / subsection / object segments appended after the site title. */
  segments?: Array<string | null | undefined>
  /** Description used for both the meta description and Open Graph. */
  description?: string
}

/**
 * Build a Next.js Metadata object with a hierarchical, context-dependent title
 * that is shared by the document <title> and the Open Graph title (the one used
 * by Telegram and other link-preview crawlers).
 */
export function pageMetadata({ segments = [], description }: PageMetadataOptions = {}): Metadata {
  const title = buildTitle(...segments)
  const resolvedDescription = description ?? SITE_TITLE

  return {
    title: { absolute: title },
    description: resolvedDescription,
    openGraph: {
      title,
      description: resolvedDescription,
      type: 'website',
      locale: 'ru_RU',
    },
  }
}
