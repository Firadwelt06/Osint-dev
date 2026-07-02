import https from 'node:https'

const SEARCH_API_KEY = process.env.SEARCH_API_KEY // set in server/.env, never commit it

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (response) => {
      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

export async function searchPublicData(target) {
  const query = encodeURIComponent(target.name)
  const apiKey = process.env.SEARCH_API_KEY
  const cx = process.env.SEARCH_ENGINE_ID
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${query}&num=5`

  const data = await fetchJson(url, {})

  return (data.items ?? []).map((item) => ({
    url: item.link,
    title: item.title,
    snippet: item.snippet,
  }))
}