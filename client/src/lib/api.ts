export const API_URL = 'http://localhost:5000'

export async function apiFetch(path: string, token?: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (options?.body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
