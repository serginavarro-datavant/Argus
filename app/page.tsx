'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import type { Project } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { ArgusLogo } from '@/components/ArgusLogo'

function IconGrid() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="0.5" y="0.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="0.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="0.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M7.5 1v1.5M7.5 12.5V14M14 7.5h-1.5M2.5 7.5H1M12.2 2.8l-1.1 1.1M3.9 11.1L2.8 12.2M12.2 12.2l-1.1-1.1M3.9 3.9L2.8 2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex" style={{ background: '#0b0b13' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
      <aside className="w-52 flex-shrink-0 flex flex-col border-r" style={{ background: '#0e0e18', borderColor: '#1c1c2b' }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: '#1c1c2b' }}>
          <div className="flex items-center gap-3">
            <ArgusLogo size={36} />
            <div>
              <div className="text-white font-semibold text-[15px] leading-tight tracking-tight">Argus</div>
              <div className="text-[13px] leading-tight font-bold" style={{ color: '#5c5cbb' }}>datavant</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5">
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#a5a8ff' }}
          >
            <span style={{ color: '#818cf8' }}><IconGrid /></span>
            Projects
          </div>
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-default"
            style={{ color: '#3a3a52' }}
          >
            <IconSettings />
            Settings
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: '#1c1c2b' }}>
          <div className="text-xs" style={{ color: '#3a3a52' }}>v0.1 · alpha</div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: '#1c1c2b' }}>
          <div className="flex items-center gap-3">
            <h1 className="text-white font-semibold text-lg">Projects</h1>
            {!loading && projects.length > 0 && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
              >
                {projects.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-white px-4 py-2 rounded-lg transition-all"
            style={{ background: '#5046e5' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#4338ca')}
            onMouseLeave={e => (e.currentTarget.style.background = '#5046e5')}
          >
            <span className="text-base leading-none">+</span>
            New project
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 px-8 py-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl h-36 animate-pulse" style={{ background: '#111119', border: '1px solid #1e1e2d' }} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState onUpload={() => setShowUpload(true)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </main>
      </div>

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={p => { setProjects(prev => [p, ...prev]); setShowUpload(false) }}
        />
      )}
    </div>
  )
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center gap-5">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: '#111119', border: '1px solid #1e1e2d' }}
      >
        <ArgusLogo size={32} />
      </div>
      <div>
        <h2 className="text-white font-semibold text-lg">No prototypes yet</h2>
        <p className="text-sm mt-1.5 max-w-xs" style={{ color: '#5c5c78' }}>
          Upload a ZIP or link a GitHub repo to start testing with real users.
        </p>
      </div>
      <button
        onClick={onUpload}
        className="text-sm font-medium text-white px-5 py-2.5 rounded-lg transition-all mt-1"
        style={{ background: '#5046e5' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#4338ca')}
        onMouseLeave={e => (e.currentTarget.style.background = '#5046e5')}
      >
        Add first prototype
      </button>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const initial = project.name.charAt(0).toUpperCase()
  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div
        className="rounded-xl p-5 transition-all duration-200"
        style={{ background: '#111119', border: '1px solid #1e1e2d' }}
        onMouseEnter={e => {
          e.currentTarget.style.border = '1px solid #2d2d42'
          e.currentTarget.style.background = '#13132000'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = '1px solid #1e1e2d'
          e.currentTarget.style.background = '#111119'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          >
            {initial}
          </div>
          <span className="text-xs" style={{ color: '#3a3a52' }}>{formatDate(project.createdAt)}</span>
        </div>

        <h3 className="text-white font-semibold text-sm mb-1.5 group-hover:text-indigo-300 transition-colors">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#5c5c78' }}>
            {project.description}
          </p>
        )}

        <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #1a1a28' }}>
          <span className="text-xs" style={{ color: '#3a3a52' }}>Prototype</span>
          <span className="text-xs font-medium transition-colors" style={{ color: '#5c5c78' }}>
            View dashboard →
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type ModalTab = 'zip' | 'github'

function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [tab, setTab] = useState<ModalTab>('zip')

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ background: '#0e0e18', border: '1px solid #1e1e2d' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-white font-semibold">New project</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors" style={{ color: '#5c5c78', background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1c1c2b'; e.currentTarget.style.color = 'white' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5c5c78' }}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6" style={{ borderColor: '#1c1c2b' }}>
          <TabBtn active={tab === 'zip'} onClick={() => setTab('zip')}>ZIP upload</TabBtn>
          <TabBtn active={tab === 'github'} onClick={() => setTab('github')}>GitHub URL</TabBtn>
        </div>

        <div className="p-6">
          {tab === 'zip' ? (
            <ZipForm onClose={onClose} onCreated={onCreated} />
          ) : (
            <GitHubForm onClose={onClose} onCreated={onCreated} />
          )}
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
      style={{
        borderColor: active ? '#6366f1' : 'transparent',
        color: active ? 'white' : '#5c5c78',
      }}
    >
      {children}
    </button>
  )
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', background: '#13131e', border: '1px solid #252535',
  borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'white',
  outline: 'none', boxSizing: 'border-box',
}

function ZipForm({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) { setError('Name and ZIP file are required.'); return }
    setBusy(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('description', description.trim())
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    setBusy(false)
    if (!res.ok) { setError('Upload failed. Make sure the file is a valid ZIP.'); return }
    onCreated(await res.json())
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Project name">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="My prototype" style={INPUT_STYLE} />
      </Field>
      <Field label="Description (optional)">
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this prototype do?" style={INPUT_STYLE} />
      </Field>
      <Field label="ZIP file">
        <div
          onClick={() => fileRef.current?.click()}
          className="rounded-xl p-6 text-center cursor-pointer transition-colors"
          style={{ border: '1.5px dashed #252535' }}
          onMouseEnter={e => (e.currentTarget.style.border = '1.5px dashed #4f46e5')}
          onMouseLeave={e => (e.currentTarget.style.border = '1.5px dashed #252535')}
        >
          {file ? (
            <div className="text-sm text-white">
              {file.name} <span style={{ color: '#5c5c78' }}>({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
            </div>
          ) : (
            <div className="text-sm" style={{ color: '#5c5c78' }}>Drop a ZIP or click to browse</div>
          )}
          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </Field>
      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
      <FormActions onClose={onClose} busy={busy} label="Upload" />
    </form>
  )
}

function parsePreview(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.hostname !== 'github.com') return null
    const parts = u.pathname.replace(/^\/|\/$/g, '').split('/')
    if (parts.length < 2) return null
    const repo = decodeURIComponent(parts[1])
    const isTree = parts[2] === 'tree' || parts[2] === 'blob'
    const branch = isTree && parts[3] ? decodeURIComponent(parts[3]) : 'main'
    const subpath = isTree && parts.length > 4 ? parts.slice(4).map(decodeURIComponent).join('/') : ''
    return `${repo} · ${branch}${subpath ? ` · ${subpath}` : ''}`
  } catch { return null }
}

function GitHubForm({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const preview = url.trim() ? parsePreview(url) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) { setError('GitHub URL is required.'); return }
    if (!preview) { setError('Paste a github.com URL (repo or folder link).'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/ingest-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined, token: token.trim() || undefined }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Failed to import.')
      return
    }
    onCreated(await res.json())
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="GitHub URL">
        <input
          value={url} onChange={e => { setUrl(e.target.value); setError('') }}
          placeholder="https://github.com/org/repo/tree/main/path/to/folder"
          style={INPUT_STYLE} autoFocus
        />
        {preview && (
          <p className="mt-1.5 text-xs font-mono" style={{ color: '#818cf8' }}>{preview}</p>
        )}
        {url.trim() && !preview && (
          <p className="mt-1.5 text-xs" style={{ color: '#f59e0b' }}>Paste a github.com link</p>
        )}
      </Field>
      <Field label="Project name (optional)">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Defaults to repo name" style={INPUT_STYLE} />
      </Field>
      <Field label="Token (private repos)">
        <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_… · or set GITHUB_TOKEN in .env" style={INPUT_STYLE} />
      </Field>
      {busy && <p className="text-xs" style={{ color: '#5c5c78' }}>Downloading from GitHub…</p>}
      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
      <FormActions onClose={onClose} busy={busy} label="Import" />
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1.5" style={{ color: '#5c5c78' }}>{label}</label>
      {children}
    </div>
  )
}

function FormActions({ onClose, busy, label }: { onClose: () => void; busy: boolean; label: string }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onClose} className="flex-1 text-sm py-2.5 rounded-lg transition-colors" style={{ background: '#1a1a28', color: '#9ca3af', border: '1px solid #252535' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#22223a')}
        onMouseLeave={e => (e.currentTarget.style.background = '#1a1a28')}>
        Cancel
      </button>
      <button type="submit" disabled={busy} className="flex-1 text-sm py-2.5 rounded-lg font-medium text-white transition-all" style={{ background: '#5046e5' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#4338ca')}
        onMouseLeave={e => (e.currentTarget.style.background = '#5046e5')}>
        {busy ? `${label}ing…` : label}
      </button>
    </div>
  )
}
