const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

async function requestJson(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, options)

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  return response.json()
}

export async function createCase(name: string, description = '') {
  return requestJson('/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  })
}

export async function createTarget(caseId: string, payload: Record<string, string>) {
  return requestJson(`/cases/${caseId}/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function runCaseScan(caseId: string) {
  return requestJson(`/cases/${caseId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
}
