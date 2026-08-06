'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import type { Project } from '@/lib/types'
import { formatDate } from '@/lib/utils'

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(setProjects).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">A</div>
            <span className="font-semibold text-white text-sm tracking-wide">Argus</span>
            <span className="text-gray-600 text-xs">/ Prototype Testing</span>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-md font-medium transition-colors"
          >
            + New project
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {loading ? (
          <div className="text-gray-500 text-sm">Loading…</div>
        ) : projects.length === 0 ? (
          <EmptyState onUpload={() => setShowUpload(true)} />
        ) : (
          <>
            <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-5">
              Projects — {projects.length}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </>
        )}
      </main>

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
    <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-3xl">
        🔭
      </div>
      <div>
        <h2 className="text-white font-semibold text-lg">No prototypes yet</h2>
        <p className="text-gray-500 text-sm mt-1">Upload a ZIP or link a GitHub repo to start testing.</p>
      </div>
      <button
        onClick={onUpload}
        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2 rounded-md font-medium transition-colors mt-2"
      >
        Add prototype
      </button>
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/project/${project.id}`} className="block group">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-gray-800/80 transition-all">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-800/50 flex items-center justify-center text-indigo-400 text-base font-bold flex-shrink-0">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-gray-500 text-xs mt-1">{formatDate(project.createdAt)}</span>
        </div>
        <h3 className="text-white font-medium text-sm mb-1 group-hover:text-indigo-300 transition-colors">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{project.description}</p>
        )}
        <div className="mt-4 pt-3 border-t border-gray-800 flex items-center gap-3 text-xs text-gray-600">
          <span>Dashboard →</span>
        </div>
      </div>
    </Link>
  )
}

type ModalTab = 'zip' | 'github'

function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [tab, setTab] = useState<ModalTab>('zip')

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-white font-semibold">New project</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
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
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-indigo-500 text-white'
          : 'border-transparent text-gray-500 hover:text-gray-300'
      }`}
    >
      {children}
    </button>
  )
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
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="My prototype"
          className={INPUT}
        />
      </Field>

      <Field label="Description (optional)">
        <input
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="What does this prototype do?"
          className={INPUT}
        />
      </Field>

      <Field label="ZIP file">
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-700 hover:border-indigo-500/50 rounded-lg p-6 text-center cursor-pointer transition-colors"
        >
          {file ? (
            <div className="text-sm text-gray-300">
              {file.name} <span className="text-gray-600">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
            </div>
          ) : (
            <div className="text-gray-600 text-sm">Drop a ZIP or click to browse</div>
          )}
          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </Field>

      {error && <p className="text-red-400 text-xs">{error}</p>}

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
      body: JSON.stringify({
        url: url.trim(),
        name: name.trim() || undefined,
        token: token.trim() || undefined,
      }),
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
          className={INPUT}
          autoFocus
        />
        {preview && (
          <p className="mt-1.5 text-xs text-indigo-400 font-mono">{preview}</p>
        )}
        {url.trim() && !preview && (
          <p className="mt-1.5 text-xs text-amber-500">Paste a github.com link</p>
        )}
      </Field>

      <Field label="Project name (optional)">
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Defaults to repo name"
          className={INPUT}
        />
      </Field>

      <Field label="Token (private repos)">
        <input
          type="password"
          value={token} onChange={e => setToken(e.target.value)}
          placeholder="ghp_… · or set GITHUB_TOKEN in .env"
          className={INPUT}
        />
      </Field>

      {busy && (
        <p className="text-gray-500 text-xs">Downloading from GitHub… this may take a moment.</p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}

      <FormActions onClose={onClose} busy={busy} label="Import" />
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function FormActions({ onClose, busy, label }: { onClose: () => void; busy: boolean; label: string }) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button" onClick={onClose}
        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit" disabled={busy}
        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-medium transition-colors"
      >
        {busy ? `${label}ing…` : label}
      </button>
    </div>
  )
}

const INPUT = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors'
