import express from 'express'
import { searchPublicData } from './publicData.js'

const app = express()
app.use(express.json())

const cases = []

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/cases', (req, res) => {
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Case name is required' })
  }

  const createdCase = {
    id: `${Date.now()}`,
    name,
    description: description || '',
    targets: [],
    findings: [],
  }

  cases.push(createdCase)
  return res.json(createdCase)
})

app.get('/cases', (_req, res) => {
  res.json(cases)
})

app.post('/cases/:caseId/targets', (req, res) => {
  const caseItem = cases.find((entry) => entry.id === req.params.caseId)

  if (!caseItem) {
    return res.status(404).json({ error: 'Case not found' })
  }

  const { name, aliases, keywords, priority } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Target name is required' })
  }

  const target = {
    id: `${Date.now()}`,
    name,
    aliases: aliases || '',
    keywords: keywords || '',
    priority: priority || 'Medium',
  }

  caseItem.targets.push(target)
  return res.json(target)
})

app.post('/cases/:caseId/scan', async (req, res) => {
  const caseItem = cases.find((entry) => entry.id === req.params.caseId)

  if (!caseItem) {
    return res.status(404).json({ error: 'Case not found' })
  }

  const findings = []

  for (const target of caseItem.targets) {
    try {
      const results = await searchPublicData(target)

      if (results.length === 0) {
        continue
      }

      for (const result of results.slice(0, 2)) {
        findings.push({
          id: `${target.id}-${Date.now()}-${findings.length}`,
          targetId: target.id,
          title: `${target.name} appears in a public result`,
          summary: `${target.name}: ${result.snippet || 'Publicly visible mention detected.'}`,
          source: 'Public web search',
          matchedTerms: [target.name, ...(target.keywords ? target.keywords.split(',') : [])].slice(0, 3),
          createdAt: new Date().toISOString().slice(0, 10),
          priority: target.priority,
          reviewed: false,
          evidenceUrl: result.url,
          followUpNote: '',
          sourceDetails: `Public web search • ${result.url}`,
        })
      }
    } catch {
      continue
    }
  }

  caseItem.findings = findings
  return res.json({ findings })
})

app.listen(4000, () => {
  console.log('OSINT backend listening on http://localhost:4000')
})
