export function createId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function elapsed(startIso: string, endIso?: string | null): string {
  const ms = new Date(endIso ?? new Date()).getTime() - new Date(startIso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
