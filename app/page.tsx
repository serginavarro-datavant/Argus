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
            + Upload prototype
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
        <p className="text-gray-500 text-sm mt-1">Upload a ZIP file to start testing.</p>
      </div>
      <button
        onClick={onUpload}
        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-5 py-2 rounded-md font-medium transition-colors mt-2"
      >
        Upload prototype
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

function UploadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Project) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) { setError('Name and ZIP file are required.'); return }
    setUploading(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('description', description.trim())
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    setUploading(false)
    if (!res.ok) { setError('Upload failed. Make sure the file is a valid ZIP.'); return }
    const project = await res.json()
    onCreated(project)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Upload prototype</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Project name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="My prototype"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description (optional)</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What does this prototype do?"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">ZIP file</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-indigo-500/50 rounded-lg p-6 text-center cursor-pointer transition-colors"
            >
              {file ? (
                <div className="text-sm text-gray-300">{file.name} <span className="text-gray-600">({(file.size / 1024 / 1024).toFixed(1)} MB)</span></div>
              ) : (
                <div className="text-gray-600 text-sm">Drop a ZIP or click to browse</div>
              )}
              <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-medium transition-colors">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
