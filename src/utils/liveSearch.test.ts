import { describe, expect, it, vi } from 'vitest'
import type { SearchSource } from './osintSearch'
import { fetchLiveFindings } from './liveSearch'
import type { WatchlistItem } from './watchlist'

describe('fetchLiveFindings', () => {
  it('builds findings from a live provider response', async () => {
    const target: WatchlistItem = {
      id: '1',
      name: 'Maya Chen',
      aliases: 'Maya, Chen',
      keywords: 'venue, meeting',
      priority: 'High',
    }

    const source: SearchSource = {
      id: 'news',
      name: 'News archive',
      description: 'Public news and press coverage',
      enabled: true,
    }

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        hits: [
          {
            title: 'Maya Chen appears at a venue meeting',
            url: 'https://example.com/news',
            points: 3,
          },
        ],
      }),
    }))

    const findings = await fetchLiveFindings([target], [source], fetchSpy as unknown as typeof fetch)

    expect(findings).toHaveLength(1)
    expect(findings[0].source).toBe('News archive')
    expect(findings[0].summary).toContain('Maya Chen')
    expect(findings[0].evidenceUrl).toBe('https://example.com/news')
    expect(findings[0].reviewed).toBe(false)
  })

  it('parses HTML search results from a public search endpoint', async () => {
    const target: WatchlistItem = {
      id: '2',
      name: 'North Harbor Group',
      aliases: 'North Harbor, Harbor Group',
      keywords: 'shipping, schedule',
      priority: 'Medium',
    }

    const source: SearchSource = {
      id: 'forums',
      name: 'Community forums',
      description: 'Public forum discussions and threads',
      enabled: true,
    }

    const fetchSpy = vi.fn(async () => ({
      ok: true,
      text: async () => `<!doctype html><html><body><a href="https://example.com/forum">North Harbor Group shipping schedule update</a><div>Forum discussion about shipping schedule and harbor group activity</div></body></html>`,
    }))

    const findings = await fetchLiveFindings([target], [source], fetchSpy as unknown as typeof fetch)

    expect(findings).toHaveLength(1)
    expect(findings[0].source).toBe('Community forums')
    expect(findings[0].summary).toContain('North Harbor Group')
  })
})
