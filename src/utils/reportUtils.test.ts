import { describe, expect, it } from 'vitest'
import { normalizeReport, parseTags } from './reportUtils'

describe('parseTags', () => {
  it('splits tags by comma and trims whitespace', () => {
    expect(parseTags('news, social,  maps')).toEqual(['news', 'social', 'maps'])
  })

  it('returns an empty array for blank input', () => {
    expect(parseTags('   ')).toEqual([])
  })
})

describe('normalizeReport', () => {
  it('fills missing OSINT fields with defaults', () => {
    const normalized = normalizeReport({
      id: '1',
      title: 'Example',
      source: 'Source',
      summary: 'Summary',
      priority: 'Medium',
      status: 'Open',
      createdAt: '2026-06-30',
      notes: '',
    })

    expect(normalized.sourceType).toBe('Other')
    expect(normalized.url).toBe('')
    expect(normalized.tags).toEqual([])
    expect(normalized.evidence).toBe('')
  })
})
