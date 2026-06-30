const API_BASE = 'http://localhost:4000'

export async function createCase(name: string, description = '') {
  const response = await fetch(`${API_BASE}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  })

  return response.json()
}

export async function createTarget(caseId: string, payload: Record<string, string>) {
  const response = await fetch(`${API_BASE}/cases/${caseId}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return response.json()
}

export async function runCaseScan(caseId: string) {
  const response = await fetch(`${API_BASE}/cases/${caseId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  return response.json()
}
