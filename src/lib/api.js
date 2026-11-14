export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  if (response.status === 204) return null

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The server returned an invalid response. Please try again.')
  }

  if (!response.ok) {
    throw new Error(payload.error || 'The request could not be completed.')
  }
  return payload
}
