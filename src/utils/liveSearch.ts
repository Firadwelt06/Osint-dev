import { type SearchSource } from './osintSearch'
import { buildSearchTerms, type Finding, type WatchlistItem } from './watchlist'

export type LiveSearchHit = {
  title: string
  url?: string
  snippet?: string
  points?: number
}

export type LiveSearchResponse = {
  hits?: LiveSearchHit[]
}

function parseHtmlResults(html: string, target: WatchlistItem): LiveSearchHit[] {
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  const anchors = [...cleaned.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]

  return anchors
    .map(([, url, title]) => ({
      title: title.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      url,
      snippet: `${target.name} public mention found in search results`,
    }))
    .filter((hit) => hit.title.length > 0)
    .slice(0, 2)
}

function buildQuery(target: WatchlistItem, source: SearchSource): string {
  const terms = buildSearchTerms(target).slice(0, 4).join(' ')
  return `${encodeURIComponent(target.name)} ${encodeURIComponent(source.name)} ${encodeURIComponent(terms)}`.trim()
}

export async function fetchLiveFindings(
  targets: WatchlistItem[],
  sources: SearchSource[],
  fetchImpl: typeof fetch = fetch,
): Promise<Finding[]> {
  const enabledSources = sources.filter((source) => source.enabled)

  if (enabledSources.length === 0) {
    return []
  }

  const findings: Finding[] = []
  const now = new Date().toISOString().slice(0, 10)

  for (const target of targets) {
    for (const source of enabledSources) {
      try {
        const query = buildQuery(target, source)
        const response = await fetchImpl(`https://r.jina.ai/http://www.google.com/search?q=${query}`)

        if (!response.ok) {
          continue
        }

        let hits: LiveSearchHit[] = []

        try {
          const data = (await response.json()) as LiveSearchResponse
          hits = data.hits ?? []
        } catch {
          const text = await response.text()
          hits = parseHtmlResults(text, target)
        }

        if (hits.length === 0) {
          continue
        }

        for (const hit of hits.slice(0, 2)) {
          findings.push({
            id: `${target.id}-${source.id}-${Date.now()}-${findings.length}`,
            targetId: target.id,
            title: hit.title || `${target.name} appears in a public result`,
            summary: `${target.name}: ${hit.snippet || hit.title || 'Publicly visible mention detected.'} Source: ${source.name}`,
            source: source.name,
            matchedTerms: buildSearchTerms(target).slice(0, 3),
            createdAt: now,
            priority: target.priority,
            reviewed: false,
            evidenceUrl: hit.url,
            sourceDetails: `${source.name} • public result • follow up from search snippet`,
          })
        }
      } catch {
        continue
      }
    }
  }

  return findings
}
