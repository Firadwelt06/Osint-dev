import https from 'node:https'

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode && response.statusCode >= 400) {
          response.resume()
          reject(new Error(`Request failed with status ${response.statusCode}`))
          return
        }

        let data = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          data += chunk
        })
        response.on('end', () => resolve(data))
      })
      .on('error', reject)
  })
}

function extractSearchLinks(text, query) {
  const matches = [...text.matchAll(/https?:\/\/[^\s"'<>]+/gi)]
  const links = matches.map((match) => match[0]).filter((link) => !link.includes('google'))
  return links.slice(0, 3).map((url) => ({
    url,
    title: `${query} public result`,
    snippet: `Public result related to ${query}`,
  }))
}

export async function searchPublicData(target) {
  const query = encodeURIComponent(target.name)
  const urls = [
    `https://r.jina.ai/http://www.google.com/search?q=${query}`,
    `https://r.jina.ai/http://www.bing.com/search?q=${query}`,
  ]

  const allResults = []

  for (const url of urls) {
    try {
      const html = await fetchText(url)
      const links = extractSearchLinks(html, target.name)
      allResults.push(...links)
    } catch {
      continue
    }
  }

  return allResults.slice(0, 6)
}
