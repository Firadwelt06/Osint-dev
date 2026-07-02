import { type FormEvent, useEffect, useMemo, useState } from 'react'
import './App.css'
import { createCase, createTarget, runCaseScan } from './utils/api'
import { buildSearchSummary, defaultSources, type SearchSource } from './utils/osintSearch'
import { buildSearchTerms, generateFindings, getFindingConfidence, getFollowUpQueue, type Finding, type ScanHistoryEntry, type WatchlistItem, type WatchlistPriority } from './utils/watchlist'

const storageKey = 'osint-watchlist-v1'
const legacyStorageKey = 'osint-reports-v1'

const starterTargets: WatchlistItem[] = [
  {
    id: '1',
    name: 'Maya Chen',
    aliases: 'Maya, Chen',
    keywords: 'venue, meeting',
    priority: 'High',
  },
  {
    id: '2',
    name: 'North Harbor Group',
    aliases: 'North Harbor, Harbor Group',
    keywords: 'shipping, schedule',
    priority: 'Medium',
  },
]

type ManualEntryForm = {
  title: string
  source: string
  summary: string
  notes: string
}

const emptyManualEntry = {
  title: '',
  source: '',
  summary: '',
  notes: '',
}

function App() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => {
    if (typeof window === 'undefined') {
      return starterTargets
    }

    const saved = window.localStorage.getItem(storageKey)
    const legacySaved = window.localStorage.getItem(legacyStorageKey)
    const source = saved ?? legacySaved

    if (!source) {
      return starterTargets
    }

    try {
      return JSON.parse(source) as WatchlistItem[]
    } catch {
      return starterTargets
    }
  })
  const [findings, setFindings] = useState<Finding[]>(() => generateFindings(starterTargets, defaultSources))
  const [targetForm, setTargetForm] = useState({ name: '', aliases: '', keywords: '', priority: 'Medium' as WatchlistPriority })
  const [manualEntry, setManualEntry] = useState<ManualEntryForm>(emptyManualEntry)
  const [selectedTargetId, setSelectedTargetId] = useState<string>(starterTargets[0]?.id ?? '')
  const [reviewAction, setReviewAction] = useState('')
  const [caseName, setCaseName] = useState('')
  const [caseDescription, setCaseDescription] = useState('')
  const [caseId, setCaseId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [sources, setSources] = useState<SearchSource[]>(defaultSources)
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState('Ready to scan')

  const unreviewedCount = findings.filter((finding) => !finding.reviewed).length
  const activeSourceCount = sources.filter((source) => source.enabled).length
  const followUpQueue = useMemo(() => getFollowUpQueue(findings), [findings])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    if (findings.length === 0) {
      setFindings(generateFindings(watchlist, sources))
    }
  }, [findings.length, watchlist, sources])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void handleRefreshScan()
    }, 90000)

    return () => window.clearInterval(interval)
  }, [watchlist, sources])

  const selectedTarget = useMemo(() => watchlist.find((item) => item.id === selectedTargetId) ?? watchlist[0], [selectedTargetId, watchlist])

  async function handleRefreshScan() {
    setIsScanning(true)
    setScanStatus('Scanning backend sources...')

    try {
      let activeCaseId = caseId

      if (!activeCaseId) {
        const createdCase = await createCase(caseName || 'New case', caseDescription)
        activeCaseId = createdCase.id
        setCaseId(activeCaseId)
      }

      for (const target of watchlist) {
        await createTarget(activeCaseId, {
          name: target.name,
          aliases: target.aliases,
          keywords: target.keywords,
          priority: target.priority,
        })
      }

      const scanResult = await runCaseScan(activeCaseId)
      const nextFindings = (scanResult.findings || []).map((finding: Finding) => ({ ...finding }))
      const scanSummary = `${watchlist.length} target${watchlist.length === 1 ? '' : 's'} scanned at ${new Date().toLocaleTimeString()}`

      setFindings(nextFindings)
      setScanHistory((current) => [
        {
          id: Date.now().toString(),
          targetId: selectedTarget?.id ?? 'all',
          createdAt: new Date().toISOString().slice(0, 10),
          summary: scanSummary,
        },
        ...current,
      ].slice(0, 6))
      setScanStatus(nextFindings.length > 0 ? `Found ${nextFindings.length} backend signal${nextFindings.length === 1 ? '' : 's'}` : 'No backend hits returned; showing fallback results')
    } catch (error) {
      const fallbackFindings = generateFindings(watchlist, sources)
      setFindings(fallbackFindings)
      const message = error instanceof Error ? error.message : 'Backend scan unavailable'
      setScanStatus(`Backend scan unavailable: ${message}`)
    } finally {
      setIsScanning(false)
    }
  }

  function toggleSource(sourceId: string) {
    setSources((current) =>
      current.map((source) => (source.id === sourceId ? { ...source, enabled: !source.enabled } : source)),
    )
  }

  function toggleReviewed(findingId: string) {
    setFindings((current) =>
      current.map((finding) => (finding.id === findingId ? { ...finding, reviewed: !finding.reviewed } : finding)),
    )
  }

  function handleReviewAction(findingId: string) {
    if (!reviewAction.trim()) {
      return
    }

    setFindings((current) =>
      current.map((finding) =>
        finding.id === findingId
          ? { ...finding, summary: `${finding.summary} Action: ${reviewAction.trim()}.`, followUpNote: reviewAction.trim() }
          : finding,
      ),
    )
    setReviewAction('')
  }

  const filteredFindings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    const normalizedTag = tagFilter.trim().toLowerCase()

    return findings.filter((finding) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        finding.title.toLowerCase().includes(normalizedSearch) ||
        finding.summary.toLowerCase().includes(normalizedSearch) ||
        finding.source.toLowerCase().includes(normalizedSearch) ||
        finding.matchedTerms.some((term) => term.toLowerCase().includes(normalizedSearch))

      const matchesTag =
        normalizedTag.length === 0 ||
        finding.matchedTerms.some((term) => term.toLowerCase().includes(normalizedTag))

      return matchesSearch && matchesTag
    })
  }, [findings, searchTerm, tagFilter])

  function handleTargetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!targetForm.name) {
      return
    }

    const newTarget: WatchlistItem = {
      id: Date.now().toString(),
      name: targetForm.name,
      aliases: targetForm.aliases,
      keywords: targetForm.keywords,
      priority: targetForm.priority,
    }

    setWatchlist((current) => [newTarget, ...current])
    setSelectedTargetId(newTarget.id)
    setTargetForm({ name: '', aliases: '', keywords: '', priority: 'Medium' })
  }

  function handleManualEntrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!manualEntry.title || !manualEntry.source || !manualEntry.summary) {
      return
    }

    const noteFinding: Finding = {
      id: Date.now().toString(),
      targetId: selectedTarget?.id ?? 'manual',
      title: manualEntry.title,
      summary: manualEntry.summary,
      source: manualEntry.source,
      matchedTerms: buildSearchTerms({
        id: selectedTarget?.id ?? 'manual',
        name: selectedTarget?.name ?? manualEntry.title,
        aliases: selectedTarget?.aliases ?? '',
        keywords: selectedTarget?.keywords ?? '',
        priority: selectedTarget?.priority ?? 'Medium',
      }),
      createdAt: new Date().toISOString().slice(0, 10),
      priority: selectedTarget?.priority ?? 'Medium',
      reviewed: false,
    }

    setFindings((current) => [noteFinding, ...current])
    setManualEntry(emptyManualEntry)
  }

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">OSINT watchlist monitor</p>
          <h1>Watch a person or organization and surface public signals as they appear.</h1>
          <p className="hero-copy">
            The system gathers likely public leads for you. You review them, keep the useful ones, and decide what to do next.
          </p>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <strong>{watchlist.length}</strong>
            <span>Targets</span>
          </div>
          <div className="stat-card">
            <strong>{findings.length}</strong>
            <span>Findings</span>
          </div>
          <div className="stat-card">
            <strong>{unreviewedCount}</strong>
            <span>Unreviewed</span>
          </div>
          <div className="stat-card">
            <strong>{activeSourceCount}</strong>
            <span>Active sources</span>
          </div>
          <div className="stat-card">
            <strong>{followUpQueue.length}</strong>
            <span>Follow-up queue</span>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="panel form-panel">
          <div className="panel-heading">
            <h2>Monitor a subject</h2>
            <p>Define who or what the automation should watch.</p>
          </div>

          <form className="report-form">
            <label>
              Case name
              <input value={caseName} onChange={(event) => setCaseName(event.target.value)} placeholder="Example: Vendor review" />
            </label>
            <label>
              Case description
              <textarea value={caseDescription} onChange={(event) => setCaseDescription(event.target.value)} rows={2} placeholder="Context for this investigation" />
            </label>
          </form>

          <form className="report-form" onSubmit={handleTargetSubmit}>
            <label>
              Name
              <input
                value={targetForm.name}
                onChange={(event) => setTargetForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Example: Maya Chen"
              />
            </label>
            <label>
              Aliases
              <input
                value={targetForm.aliases}
                onChange={(event) => setTargetForm((current) => ({ ...current, aliases: event.target.value }))}
                placeholder="Alternative names"
              />
            </label>
            <label>
              Keywords
              <input
                value={targetForm.keywords}
                onChange={(event) => setTargetForm((current) => ({ ...current, keywords: event.target.value }))}
                placeholder="venue, meeting"
              />
            </label>
            <label>
              Priority
              <select
                value={targetForm.priority}
                onChange={(event) =>
                  setTargetForm((current) => ({ ...current, priority: event.target.value as WatchlistPriority }))
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
            <button type="submit">Add target</button>
          </form>

          <div className="panel-heading secondary-heading">
            <h2>Capture a verification note</h2>
            <p>Record your own judgement when a finding needs context.</p>
          </div>

          <form className="report-form" onSubmit={handleManualEntrySubmit}>
            <label>
              Target
              <select value={selectedTargetId} onChange={(event) => setSelectedTargetId(event.target.value)}>
                {watchlist.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input
                value={manualEntry.title}
                onChange={(event) => setManualEntry((current) => ({ ...current, title: event.target.value }))}
                placeholder="New lead or note"
              />
            </label>
            <label>
              Source
              <input
                value={manualEntry.source}
                onChange={(event) => setManualEntry((current) => ({ ...current, source: event.target.value }))}
                placeholder="Personal note, archive, or source"
              />
            </label>
            <label>
              Summary
              <textarea
                value={manualEntry.summary}
                onChange={(event) => setManualEntry((current) => ({ ...current, summary: event.target.value }))}
                rows={3}
                placeholder="Briefly describe what you observed"
              />
            </label>
            <label>
              Notes
              <textarea
                value={manualEntry.notes}
                onChange={(event) => setManualEntry((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                placeholder="Optional context or next action"
              />
            </label>
            <button type="submit">Save note</button>
          </form>
        </section>

        <section className="panel list-panel">
          <div className="panel-heading">
            <div>
              <h2>Automated findings</h2>
              <p>Signals are collected for you; you verify what matters.</p>
            </div>
            <button type="button" className="ghost" onClick={handleRefreshScan} disabled={isScanning}>
              {isScanning ? 'Scanning…' : 'Refresh scan'}
            </button>
          </div>

          <div className="filter-bar">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search findings"
            />
            <input
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Filter by tag"
            />
          </div>

          {selectedTarget ? (
            <div className="target-summary">
              <h3>{selectedTarget.name}</h3>
              <p>
                Aliases: {selectedTarget.aliases || 'None'}
              </p>
              <p>
                Keywords: {selectedTarget.keywords || 'None'}
              </p>
              <p className="search-summary">
                {buildSearchSummary(selectedTarget.name, buildSearchTerms(selectedTarget), sources)}
              </p>
              <p className="search-summary">
                Triage posture: {selectedTarget.priority} priority • {activeSourceCount} active source{activeSourceCount === 1 ? '' : 's'}
              </p>
            </div>
          ) : null}

          <div className="source-toggle-list">
            {sources.map((source) => (
              <label key={source.id} className="source-toggle-item">
                <input type="checkbox" checked={source.enabled} onChange={() => toggleSource(source.id)} />
                <span>
                  <strong>{source.name}</strong>
                  <small>{source.description}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="scan-history">
            <h3>Recent scans</h3>
            <p className="search-summary">{scanStatus}</p>
            {scanHistory.map((entry) => (
              <div key={entry.id} className="history-item">
                <strong>{entry.summary}</strong>
                <span>{entry.createdAt}</span>
              </div>
            ))}
          </div>

          {followUpQueue.length > 0 ? (
            <div className="scan-history">
              <h3>Follow-up queue</h3>
              {followUpQueue.map((finding) => (
                <div key={finding.id} className="history-item">
                  <strong>{finding.title}</strong>
                  <span>{finding.followUpNote}</span>
                </div>
              ))}
            </div>
          ) : null}

          <div className="report-list">
            {filteredFindings.map((finding) => (
              <article key={finding.id} className="report-card">
                <div className="report-topline">
                  <div>
                    <h3>{finding.title}</h3>
                    <p>
                      {finding.source} • {finding.createdAt}
                    </p>
                  </div>
                  <span className={`pill ${finding.priority.toLowerCase()}`}>{finding.priority}</span>
                </div>

                <p className="report-summary">{finding.summary}</p>
                <div className="meta-row">
                  <span className="meta-pill">Matched: {finding.matchedTerms.join(', ')}</span>
                  <span className="meta-pill muted">Confidence: {finding.confidence ?? getFindingConfidence(finding.priority, Boolean(finding.evidenceUrl))}</span>
                </div>
                {finding.evidenceUrl ? (
                  <div className="source-link-group">
                    <span className="meta-pill muted">Source URL</span>
                    <a className="source-link" href={finding.evidenceUrl} target="_blank" rel="noreferrer">
                      {finding.evidenceUrl}
                    </a>
                  </div>
                ) : null}
                {selectedTarget && finding.targetId === selectedTarget.id ? (
                  <p className="report-notes">Linked to {selectedTarget.name}</p>
                ) : null}
                {finding.sourceDetails ? (
                  <p className="report-notes">Source details: {finding.sourceDetails}</p>
                ) : null}
                {finding.followUpNote ? (
                  <p className="report-notes">Follow-up: {finding.followUpNote}</p>
                ) : null}

                <div className="report-actions">
                  <span className={`review-state ${finding.reviewed ? 'reviewed' : ''}`}>
                    {finding.reviewed ? 'Reviewed' : 'Needs review'}
                  </span>
                  <button type="button" className="ghost" onClick={() => toggleReviewed(finding.id)}>
                    {finding.reviewed ? 'Undo review' : 'Mark reviewed'}
                  </button>
                </div>
                <div className="inline-fields review-inline">
                  <label>
                    Review action
                    <input
                      value={reviewAction}
                      onChange={(event) => setReviewAction(event.target.value)}
                      placeholder="e.g. Save for follow-up"
                    />
                  </label>
                  <button type="button" onClick={() => handleReviewAction(finding.id)}>
                    Record action
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
