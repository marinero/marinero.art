const URL_RE = /https?:\/\/[^\s<>"'()[\]{}]+/gi

export function songSlugFromHref(href: string): string | null {
  try {
    const url = new URL(href, 'https://marinero.art')
    const match = url.pathname.match(/^\/songs\/([a-z0-9-]+)\/?$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function trimUrl(raw: string): { href: string; trail: string } {
  let href = raw
  let trail = ''
  while (href.length > 8 && /[.,;:!?)]$/.test(href)) {
    trail = href.slice(-1) + trail
    href = href.slice(0, -1)
  }
  return { href, trail }
}

export function isUrlLikeLabel(text: string, href: string): boolean {
  const label = text.trim()
  if (!label) return true
  const stripped = href.replace(/\/$/, '')
  return (
    label === href ||
    label === stripped ||
    label === href.replace(/^https?:\/\//, '') ||
    songSlugFromHref(href) === label
  )
}

function titleForHref(href: string, titles: Map<string, string>): string | null {
  const slug = songSlugFromHref(href)
  if (!slug) return null
  return titles.get(slug) ?? null
}

export function enhancePlanHtml(
  html: string,
  songs: { slug: string; title: string }[]
): string {
  if (!html || typeof DOMParser === 'undefined') return html

  const titles = new Map(songs.map((song) => [song.slug, song.title]))
  const doc = new DOMParser().parseFromString(`<div id="__plan">${html}</div>`, 'text/html')
  const root = doc.getElementById('__plan')
  if (!root) return html

  for (const anchor of Array.from(root.querySelectorAll('a'))) {
    const href = anchor.getAttribute('href') || ''
    if (!href) continue
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
    const title = titleForHref(href, titles)
    if (title && isUrlLikeLabel(anchor.textContent || '', href)) {
      anchor.textContent = title
    }
  }

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest('a')) return NodeFilter.FILTER_REJECT
      URL_RE.lastIndex = 0
      return URL_RE.test(node.textContent || '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })

  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)

  for (const textNode of nodes) {
    const text = textNode.textContent || ''
    URL_RE.lastIndex = 0
    const fragment = doc.createDocumentFragment()
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = URL_RE.exec(text))) {
      const { href, trail } = trimUrl(match[0])
      if (match.index > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, match.index)))
      }
      const anchor = doc.createElement('a')
      anchor.setAttribute('href', href)
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
      anchor.textContent = titleForHref(href, titles) ?? href
      fragment.appendChild(anchor)
      if (trail) fragment.appendChild(doc.createTextNode(trail))
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)))
    }
    textNode.parentNode?.replaceChild(fragment, textNode)
  }

  return root.innerHTML
}
