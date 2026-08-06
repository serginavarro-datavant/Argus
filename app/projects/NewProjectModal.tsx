'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

type Tab = 'zip' | 'url'

export default function NewProjectModal() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('zip')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [token, setToken] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function reset() {
    setName(''); setDescription(''); setGithubUrl(''); setToken('')
    setFile(null); setError(''); setLoading(false); setTab('zip')
  }

  function close() { setOpen(false); reset() }

  async function submit() {
    setError('')
    if (!name.trim()) { setError('Project name is required.'); return }

    setLoading(true)
    try {
      let res: Response
      if (tab === 'zip') {
        if (!file) { setError('Choose a ZIP file.'); setLoading(false); return }
        const fd = new FormData()
        fd.append('file', file)
        fd.append('name', name)
        fd.append('description', description)
        res = await fetch('/api/upload', { method: 'POST', body: fd })
      } else {
        if (!githubUrl.trim()) { setError('Enter a GitHub URL.'); setLoading(false); return }
        res = await fetch('/api/ingest-repo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: githubUrl, name, token: token || undefined }),
        })
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Error ${res.status}`)
        setLoading(false)
        return
      }

      const data = await res.json()
      close()
      router.push(`/project/${data.id}`)
    } catch (e) {
      setError(String(e))
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
        style={{ background: '#5046e5' }}
      >
        + New project
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) close() }}
        >
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl"
            style={{ background: S.surface, border: `1px solid ${S.border}` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: S.border }}>
              <h2 className="text-base font-bold text-white">New project</h2>
              <button
                onClick={close}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: S.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1c1c2b')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Tabs */}
              <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: S.card }}>
                {(['zip', 'url'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="flex-1 text-xs font-medium py-1.5 rounded-md transition-all"
                    style={{
                      background: tab === t ? '#1c1c2b' : 'transparent',
                      color: tab === t ? '#fff' : S.muted,
                    }}
                  >
                    {t === 'zip' ? 'Upload ZIP' : 'GitHub URL'}
                  </button>
                ))}
              </div>

              {/* Common fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: S.muted }}>Project name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="My prototype"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                    style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: S.muted }}>Description <span style={{ color: S.dim }}>(optional)</span></label>
                  <input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What is this prototype testing?"
                    className="w-full text-sm rounded-lg px-3 py-2 outline-none"
                    style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
                  />
                </div>
              </div>

              {/* Tab-specific inputs */}
              {tab === 'zip' ? (
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: S.muted }}>ZIP file</label>
                  <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full text-sm rounded-lg px-3 py-3 text-left transition-colors"
                    style={{ background: S.card, border: `1px dashed ${file ? '#4f46e5' : S.border}`, color: file ? '#a5b4fc' : S.muted }}
                  >
                    {file ? `📦 ${file.name}` : 'Click to choose a .zip file…'}
                  </button>
                  <p className="text-[10px] mt-1.5" style={{ color: S.dim }}>
                    Must contain an index.html at the root or one level deep.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: S.muted }}>GitHub URL</label>
                    <input
                      value={githubUrl}
                      onChange={e => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/org/repo/tree/main/dist"
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none font-mono"
                      style={{ background: S.card, border: `1px solid ${S.border}`, color: '#a5b4fc' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: S.muted }}>
                      Personal access token <span style={{ color: S.dim }}>(optional, for private repos)</span>
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      placeholder="ghp_…"
                      className="w-full text-sm rounded-lg px-3 py-2 outline-none font-mono"
                      style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.08)', color: '#f87171', border: '1px solid rgba(220,38,38,0.15)' }}>
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 pb-5">
              <button
                onClick={close}
                className="text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                style={{ color: S.muted }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={loading}
                className="text-sm font-medium text-white px-5 py-2 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: '#5046e5' }}
              >
                {loading ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
