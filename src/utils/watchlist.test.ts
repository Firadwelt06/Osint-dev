import { describe, expect, it } from 'vitest'
import { defaultSources } from './osintSearch'
import { buildSearchTerms, generateFindings, getFindingConfidence, getFollowUpQueue, type Finding, type WatchlistItem } from './watchlist'

describe('buildSearchTerms', () => {
  it('builds a normalized search term list for a target', () => {
    const target: WatchlistItem = {
      id: '1',
      name: 'Maya Chen',
      aliases: 'Maya, Chen',
      keywords: 'venue, meeting',
      priority: 'High',
    }

    expect(buildSearchTerms(target)).toEqual(['maya', 'chen', 'venue', 'meeting'])
  })
})

describe('getFollowUpQueue', () => {
  it('returns findings that have a follow-up action recorded', () => {
    const findings: Finding[] = [
      {
        id: '1',
        targetId: 't1',
        title: 'A',
        summary: 'One',
        source: 'News archive',
        matchedTerms: ['a'],
        createdAt: '2026-06-30',
        priority: 'High',
        reviewed: false,
        followUpNote: 'Save for later',
      },
      {
        id: '2',
        targetId: 't1',
        title: 'B',
        summary: 'Two',
        source: 'Social snapshot',
        matchedTerms: ['b'],
        createdAt: '2026-06-30',
        priority: 'Medium',
        reviewed: false,
      },
    ]

    expect(getFollowUpQueue(findings)).toHaveLength(1)
    expect(getFollowUpQueue(findings)[0].followUpNote).toBe('Save for later')
  })
})

describe('getFindingConfidence', () => {
  it('maps higher priority targets to higher confidence levels', () => {
    expect(getFindingConfidence('High', true)).toBe('High')
    expect(getFindingConfidence('Medium', false)).toBe('Medium')
    expect(getFindingConfidence('Low', false)).toBe('Low')
  })
})

describe('generateFindings', () => {
  it('returns findings that match the target terms and start unreviewed', () => {
    const target: WatchlistItem = {
      id: '1',
      name: 'Maya Chen',
      aliases: 'Maya, Chen',
      keywords: 'venue, meeting',
      priority: 'High',
    }

    const findings = generateFindings([target])

    expect(findings.length).toBeGreaterThan(0)
    expect(findings[0].matchedTerms).toContain('maya')
    expect(findings[0].priority).toBe('High')
    expect(findings[0].reviewed).toBe(false)
  })

  it('uses enabled search sources when building findings', () => {
    const target: WatchlistItem = {
      id: '2',
      name: 'North Harbor Group',
      aliases: 'North Harbor, Harbor Group',
      keywords: 'shipping, schedule',
      priority: 'Medium',
    }

    const findings = generateFindings([target], [
      { ...defaultSources[0], enabled: true },
      { ...defaultSources[1], enabled: false },
    ])

    expect(findings[0].source).toBe('News archive')
    expect(findings[0].summary).toContain('News archive')
  })
})
