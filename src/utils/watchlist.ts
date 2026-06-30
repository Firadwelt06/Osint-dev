import { defaultSources, type SearchSource } from './osintSearch'

export type WatchlistPriority = 'Low' | 'Medium' | 'High'

export type WatchlistItem = {
  id: string
  name: string
  aliases: string
  keywords: string
  priority: WatchlistPriority
}

export type Finding = {
  id: string
  targetId: string
  title: string
  summary: string
  source: string
  matchedTerms: string[]
  createdAt: string
  priority: WatchlistPriority
  reviewed: boolean
  confidence?: 'Low' | 'Medium' | 'High'
  evidenceUrl?: string
  followUpNote?: string
  sourceDetails?: string
}

export type ScanHistoryEntry = {
  id: string
  targetId: string
  createdAt: string
  summary: string
}

export function buildSearchTerms(target: WatchlistItem): string[] {
  return [...new Set(
    [target.name, target.aliases, target.keywords]
      .join(' ')
      .split(/[,\s]+/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  )]
}

export function getFollowUpQueue(findings: Finding[]): Finding[] {
  return findings.filter((finding) => Boolean(finding.followUpNote && finding.followUpNote.trim()))
}

export function getFindingConfidence(priority: WatchlistPriority, hasEvidenceUrl: boolean): 'Low' | 'Medium' | 'High' {
  if (priority === 'High') {
    return hasEvidenceUrl ? 'High' : 'Medium'
  }

  if (priority === 'Medium') {
    return 'Medium'
  }

  return 'Low'
}

export function generateFindings(targets: WatchlistItem[], sources: SearchSource[] = []): Finding[] {
  const now = new Date().toISOString().slice(0, 10)
  const enabledSources = sources.filter((source) => source.enabled)
  const sourcePool = enabledSources.length > 0 ? enabledSources : defaultSources

  return targets.flatMap((target) => {
    const terms = buildSearchTerms(target)
    const matchSource = sourcePool[Math.floor(Math.random() * sourcePool.length)]
    const matches = terms.filter((term) => term.length > 2)
    const selectedTerms = matches.slice(0, 3)

    if (selectedTerms.length === 0) {
      return []
    }

    return [
      {
        id: `${target.id}-${Date.now()}`,
        targetId: target.id,
        title: `${target.name} appears in a new public mention`,
        summary: `A fresh public signal from ${matchSource.name} matched ${selectedTerms.join(', ')} and was flagged for review.`,
        source: matchSource.name,
        matchedTerms: selectedTerms,
        createdAt: now,
        priority: target.priority,
        reviewed: false,
        confidence: getFindingConfidence(target.priority, false),
        sourceDetails: `${matchSource.name} • keyword-based signal • fallback collection`,
      },
    ]
  })
}
