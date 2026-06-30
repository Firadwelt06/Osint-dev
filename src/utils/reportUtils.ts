export type ReportStatus = 'Open' | 'Monitoring' | 'Resolved'
export type ReportPriority = 'Low' | 'Medium' | 'High'
export type SourceType = 'Social' | 'News' | 'Forum' | 'Public Record' | 'Other'

export type Report = {
  id: string
  title: string
  source: string
  summary: string
  priority: ReportPriority
  status: ReportStatus
  createdAt: string
  notes: string
  sourceType?: SourceType
  url?: string
  tags?: string[]
  evidence?: string
}

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function normalizeReport(report: Report): Report {
  return {
    ...report,
    sourceType: report.sourceType ?? 'Other',
    url: report.url ?? '',
    tags: report.tags ?? [],
    evidence: report.evidence ?? '',
  }
}
