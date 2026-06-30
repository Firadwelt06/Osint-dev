export type SearchSource = {
  id: string
  name: string
  description: string
  enabled: boolean
}

export const defaultSources: SearchSource[] = [
  {
    id: 'news',
    name: 'News archive',
    description: 'Public news and press coverage',
    enabled: true,
  },
  {
    id: 'social',
    name: 'Social snapshot',
    description: 'Public posts and social mentions',
    enabled: true,
  },
  {
    id: 'forums',
    name: 'Community forums',
    description: 'Public forum discussions and threads',
    enabled: true,
  },
  {
    id: 'records',
    name: 'Open records',
    description: 'Publicly available records and notices',
    enabled: false,
  },
]

export function getEnabledSources(sources: SearchSource[]): SearchSource[] {
  return sources.filter((source) => source.enabled)
}

export function buildSearchSummary(targetName: string, _terms: string[], sources: SearchSource[]): string {
  const enabledSources = getEnabledSources(sources)
  const sourceLabel = enabledSources.length > 0 ? enabledSources.map((source) => source.name).join(', ') : 'No active sources'

  return `${targetName} is being searched across ${sourceLabel}.`
}
