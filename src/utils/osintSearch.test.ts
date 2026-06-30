import { describe, expect, it } from 'vitest'
import { buildSearchSummary, defaultSources, getEnabledSources } from './osintSearch'

describe('getEnabledSources', () => {
  it('returns only enabled sources', () => {
    expect(getEnabledSources(defaultSources)).toHaveLength(3)
  })
})

describe('buildSearchSummary', () => {
  it('builds a readable summary for active sources', () => {
    const summary = buildSearchSummary('Maya Chen', ['maya', 'venue'], defaultSources)
    expect(summary).toContain('Maya Chen')
    expect(summary).toContain('News archive')
  })
})
