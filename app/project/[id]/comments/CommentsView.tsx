'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Project, Session, Comment } from '@/lib/types'
import { mountReadOnlyLayer, type ReadOnlyPin, type ReadOnlyLayerHandle } from '@/lib/overlay/commentLayer'

const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

interface Props {
  project: Project
  sessions: Session[]
  comments: Comment[]
}

export default function CommentsView({ project, sessions, comments }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const layerRef = useRef<ReadOnlyLayerHandle | null>(null)
  const pinsRef = useRef<ReadOnlyPin[]>([])
  const pendingHighlightRef = useRef<string | null>(null)
  const pendingNavRef = useRef<{ commentId: string; navSteps: string[] } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinsVisible, setPinsVisible] = useState(true)
  const [filterSession, setFilterSession] = useState<string>('all')

  const colorFor = useCallback((sessionId: string) => {
    const idx = sessions.findIndex(s => s.id === sessionId)
    return USER_COLORS[idx % USER_COLORS.length]
  }, [sessions])

  const visibleComments = useMemo(() =>
    filterSession === 'all' ? comments : comments.filter(c => c.sessionId === filterSession),
    [comments, filterSession],
  )

  const protoSrc = `/serve/${project.id}/${[project.uploadPath, project.entryPath].filter(Boolean).join('/')}`

  const pins: ReadOnlyPin[] = useMemo(() =>
    visibleComments.map((c, i) => ({
      id: c.id,
      selector: c.selector,
      fractX: c.ox ?? 0.5,
      fractY: c.oy ?? 0.5,
      text: c.text,
      pageUrl: c.screen || c.pageUrl,
      color: colorFor(c.sessionId),
      number: i + 1,
    })),
    [visibleComments, colorFor],
  )

  // Parse ?_argusNav= click steps and ?_argusHash= SPA hash from a screen URL
  function parseNavSteps(rawUrl: string): { basePath: string; argusHash: string; navSteps: string[] } {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : `http://x${rawUrl}`)
      const navSteps = (u.searchParams.get('_argusNav') ?? '').split('|').filter(Boolean)
      const argusHash = u.searchParams.get('_argusHash') ?? ''
      const basePath = u.pathname
      return { basePath, argusHash, navSteps }
    } catch {
      return { basePath: rawUrl.split('?')[0] || '/', argusHash: '', navSteps: [] }
    }
  }

  // Execute a click sequence inside the iframe, waiting between steps for React to re-render
  async function executeNavSteps(steps: string[], commentId: string) {
    const iDoc = iframeRef.current?.contentDocument
    if (!iDoc) return
    for (const selector of steps) {
      let el = iDoc.querySelector(selector) as HTMLElement | null
      // CSS :nth-of-type counts by tag among siblings — if buttons are in separate parent slots
      // querySelector returns null. Fall back to querySelectorAll + index.
      if (!el) {
        const nthMatch = selector.match(/^(.+):nth-of-type\((\d+)\)$/)
        if (nthMatch) {
          const [, base, nStr] = nthMatch
          el = (iDoc.querySelectorAll(base)[parseInt(nStr, 10) - 1] as HTMLElement) ?? null
        }
      }
      if (el) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        await new Promise(r => setTimeout(r, 450))
      }
    }
    layerRef.current?.reposition()
    setTimeout(() => layerRef.current?.highlightPin(commentId), 150)
  }

  const setupLayer = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    layerRef.current?.destroy()
    layerRef.current = mountReadOnlyLayer(iframe, { onPinClick: handlePinClick })
    layerRef.current.setPins(pinsRef.current)
    layerRef.current.setVisible(pinsRef.current.length > 0)
    // After page load, execute any pending click-sequence navigation
    if (pendingNavRef.current) {
      const { commentId, navSteps } = pendingNavRef.current
      pendingNavRef.current = null
      if (navSteps.length > 0) {
        setTimeout(() => executeNavSteps(navSteps, commentId), 150)
      } else {
        setTimeout(() => layerRef.current?.highlightPin(commentId), 150)
      }
    } else if (pendingHighlightRef.current) {
      const id = pendingHighlightRef.current
      pendingHighlightRef.current = null
      setTimeout(() => layerRef.current?.highlightPin(id), 150)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePinClick(id: string) {
    setActiveId(id)
    layerRef.current?.highlightPin(id)
  }

  function handleCommentClick(comment: Comment) {
    const rawUrl = comment.screen || comment.pageUrl
    setActiveId(comment.id)
    if (!rawUrl) { layerRef.current?.highlightPin(comment.id); return }

    const { basePath, argusHash, navSteps } = parseNavSteps(rawUrl)
    const iDoc = iframeRef.current?.contentDocument

    if (argusHash) {
      // Hash-based SPA navigation: change the iframe hash and wait for React to re-render.
      // No onLoad fires for hash changes, so we reposition and highlight via setTimeout.
      const elInView = comment.selector && iDoc ? iDoc.querySelector(comment.selector) !== null : false
      if (elInView) {
        layerRef.current?.highlightPin(comment.id)
      } else {
        const win = iframeRef.current?.contentWindow
        if (win) win.location.hash = argusHash.startsWith('#') ? argusHash.slice(1) : argusHash
        setTimeout(() => {
          layerRef.current?.reposition()
          layerRef.current?.highlightPin(comment.id)
        }, 500)
      }
    } else if (navSteps.length === 0) {
      // No deep nav — check if the pinned element is visible right now.
      // For SPAs the URL never changes, so we use DOM presence instead of URL comparison.
      const elInView = comment.selector && iDoc ? iDoc.querySelector(comment.selector) !== null : true
      if (elInView) {
        layerRef.current?.highlightPin(comment.id)
      } else {
        pendingHighlightRef.current = comment.id
        iframeRef.current?.contentWindow?.location.assign(basePath)
      }
    } else {
      // Deep navigation via click sequence.
      // If the first click target exists we're already on the right starting page.
      const firstStepInView = iDoc ? iDoc.querySelector(navSteps[0]) !== null : false
      if (firstStepInView) {
        executeNavSteps(navSteps, comment.id)
      } else {
        pendingNavRef.current = { commentId: comment.id, navSteps }
        iframeRef.current?.contentWindow?.location.assign(basePath)
      }
    }
  }

  // If the iframe was already loaded before onLoad could be wired up (SSR hydration race),
  // call setupLayer manually on mount.
  useEffect(() => {
    const iframe = iframeRef.current
    if (iframe && iframe.contentDocument?.readyState === 'complete') {
      setupLayer()
    }
  }, [setupLayer])

  useEffect(() => {
    pinsRef.current = pins
    layerRef.current?.setPins(pins)
  }, [pins])

  useEffect(() => {
    layerRef.current?.setVisible(pinsVisible)
  }, [pinsVisible])

  useEffect(() => {
    const iv = setInterval(() => layerRef.current?.reposition(), 600)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => () => { layerRef.current?.destroy() }, [])

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center gap-4" style={{ background: S.bg }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 4a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2h-5l-5 5v-5H6a2 2 0 01-2-2V4z" stroke="#3a3a52" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-white font-medium">No comments yet</p>
          <p className="text-sm mt-1" style={{ color: S.muted }}>Comments appear here once testers pin them during a session.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen overflow-hidden" style={{ background: '#000' }}>
      <iframe
        ref={iframeRef}
        src={protoSrc}
        onLoad={setupLayer}
        className="flex-1 h-full border-0"
        title="Prototype preview"
      />

      {/* Floating comment panel */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col h-full"
        style={{ background: 'rgba(14,14,24,0.97)', borderLeft: `1px solid ${S.border}` }}
      >
        {/* Panel header */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: S.border }}>
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white">Comments</h2>
              <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                {visibleComments.length} of {comments.length} pinned
              </p>
            </div>
            <button
              onClick={() => setPinsVisible(v => !v)}
              className="flex-shrink-0 px-2 py-1 rounded-md text-xs transition-colors"
              style={{
                background: pinsVisible ? 'rgba(80,70,229,0.2)' : 'rgba(255,255,255,0.05)',
                color: pinsVisible ? '#818cf8' : S.dim,
                border: `1px solid ${pinsVisible ? '#4f46e5' : S.border}`,
              }}
            >
              {pinsVisible ? '● on' : '○ off'}
            </button>
          </div>

          {/* Session filter */}
          {sessions.length > 1 && (
            <select
              value={filterSession}
              onChange={e => setFilterSession(e.target.value)}
              className="w-full text-xs rounded-lg px-2.5 py-1.5 outline-none"
              style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
            >
              <option value="all">All testers</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.testerName}</option>
              ))}
            </select>
          )}
        </div>

        {/* Comment list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {visibleComments.map((c, i) => {
            const session = sessions.find(s => s.id === c.sessionId)
            const isActive = activeId === c.id
            return (
              <button
                key={c.id}
                onClick={() => handleCommentClick(c)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{
                  background: isActive ? 'rgba(80,70,229,0.2)' : 'rgba(17,17,25,0.8)',
                  border: `1px solid ${isActive ? '#4f46e5' : S.border}`,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    style={{ background: colorFor(c.sessionId) }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[10px] flex-1 truncate font-medium" style={{ color: '#e0e7ff' }}>
                    {session?.testerName ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: S.dim }}>
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: isActive ? '#c7d2fe' : S.muted }}>
                  {c.text}
                </p>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
