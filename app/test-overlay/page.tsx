'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Project } from '@/lib/types'
import { ArgusLogo } from '@/components/ArgusLogo'
import { TaskBar } from '@/lib/overlay/taskBar'
import { mountCommentLayer, type Pin, type CommentLayerHandle } from '@/lib/overlay/commentLayer'
import { attachRecorder, type RecorderHandle, type PathEvent } from '@/lib/overlay/recorder'

const DEMO_TASKS = [
  { id: 't1', title: 'Find settings', description: 'Try to locate the settings or configuration page.' },
  { id: 't2', title: 'Check filters', description: 'See if you can find a way to filter or sort results.' },
]

export default function TestOverlayPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [commentMode, setCommentMode] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [path, setPath] = useState<PathEvent[]>([])
  const [taskIdx, setTaskIdx] = useState(0)
  const [startedAt] = useState(() => new Date())

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const layerRef = useRef<CommentLayerHandle | null>(null)
  const recorderRef = useRef<RecorderHandle | null>(null)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then((data: Project[]) => {
        setProjects(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
  }, [])

  const setupOverlay = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    layerRef.current?.destroy()
    recorderRef.current?.detach()

    recorderRef.current = attachRecorder(iframe, e => setPath(prev => [...prev, e]))

    layerRef.current = mountCommentLayer(iframe, {
      onPin: pin => setPins(prev => [...prev, pin]),
    })
    // commentMode state may be stale here; the effect below syncs it
  }, [])

  // Sync comment mode into the layer whenever either changes
  useEffect(() => {
    layerRef.current?.setEnabled(commentMode)
  }, [commentMode])

  // Re-setup when project changes (new iframe src)
  useEffect(() => {
    setPins([])
    setPath([])
    // setupOverlay is called by the iframe onLoad handler
  }, [selectedId])

  const selected = projects.find(p => p.id === selectedId)
  const iframeSrc = selected
    ? `/serve/${selectedId}/${[selected.uploadPath, selected.entryPath].filter(Boolean).join('/')}`
    : ''

  return (
    <div className="min-h-screen flex flex-col" style={{ height: '100vh', background: '#0b0b13' }}>
      {/* Header */}
      <header className="px-5 h-12 flex items-center gap-3 shrink-0 border-b" style={{ background: '#0e0e18', borderColor: '#1c1c2b' }}>
        <ArgusLogo size={22} />
        <span className="text-white text-sm font-semibold">Argus</span>
        <span className="text-xs" style={{ color: '#3a3a52' }}>/ Overlay test</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-gray-500 text-xs">Prototype</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 rounded outline-none focus:border-indigo-500"
          >
            {projects.length === 0 && <option value="">No projects yet</option>}
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </header>

      {/* Task bar */}
      <div className="shrink-0">
        <TaskBar
          tasks={DEMO_TASKS}
          currentTaskIdx={taskIdx}
          startedAt={startedAt}
          commentMode={commentMode}
          onToggleComment={() => setCommentMode(m => !m)}
          onTaskDone={() => setTaskIdx(i => Math.min(i + 1, DEMO_TASKS.length - 1))}
          onStuck={() => setPath(prev => [...prev, { type: 'click', label: '[stuck]', role: 'button', timestamp: new Date().toISOString() }])}
        />
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Iframe */}
        <div className="flex-1 relative bg-gray-900">
          {iframeSrc ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              onLoad={setupOverlay}
              className="w-full h-full border-0"
              title="Prototype preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              {projects.length === 0 ? 'No prototypes uploaded yet.' : 'Select a prototype above.'}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-72 flex flex-col shrink-0 overflow-hidden" style={{ borderLeft: '1px solid #1c1c2b' }}>
          {/* Pins */}
          <div className="p-3 border-b border-gray-800 shrink-0">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
              Pins — {pins.length}
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {pins.length === 0 && (
                <p className="text-gray-600 text-xs">Enable 📌 Pin then click an element.</p>
              )}
              {pins.map((pin, i) => (
                <div key={pin.id} className="bg-gray-900 rounded p-2 text-xs">
                  <span className="bg-indigo-600 text-white rounded-full w-4 h-4 inline-flex items-center justify-center text-[9px] font-bold mr-1.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-300">{pin.text}</span>
                  <div className="text-gray-600 mt-0.5 font-mono truncate">{pin.selector}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Path */}
          <div className="p-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wide">
                Path — {path.length}
              </h3>
              {path.length > 0 && (
                <button
                  onClick={() => setPath([])}
                  className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {path.length === 0 && (
                <p className="text-gray-600 text-xs">Interactions will appear here.</p>
              )}
              {[...path].reverse().map((e, i) => (
                <div key={i} className="text-xs rounded bg-gray-900 px-2 py-1">
                  <span className={`font-semibold ${e.type === 'navigation' ? 'text-indigo-400' : 'text-gray-400'}`}>
                    {e.type}
                  </span>
                  {e.type === 'navigation' && e.url && (
                    <span className="text-gray-500 ml-1 font-mono truncate block">{e.url.split('/').slice(-2).join('/')}</span>
                  )}
                  {e.type === 'click' && (
                    <span className="text-gray-500 ml-1">
                      {e.label ? `"${e.label}"` : e.role}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
