'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import type { Project, Session, Scenario, PathEvent } from '@/lib/types'
import { OVERLAY_SCRIPT } from '@/lib/overlay/overlay'
import { elapsed } from '@/lib/utils'

export default function TesterRunPage() {
  const params = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = params.projectId
  const sessionId = searchParams.get('sessionId')

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const eventsRef = useRef<PathEvent[]>([])
  const pendingFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [project, setProject] = useState<Project | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set())
  const [commentCount, setCommentCount] = useState(0)
  const [ended, setEnded] = useState(false)
  const [ending, setEnding] = useState(false)
  const [elapsed_, setElapsed] = useState('0s')

  // Load project + session
  useEffect(() => {
    if (!sessionId) { router.replace(`/t/${projectId}`); return }
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch(`/api/sessions/${sessionId}`).then(r => r.json()),
    ]).then(([p, s]) => {
      setProject(p)
      setSession(s)
      if (s.scenarioId) {
        fetch(`/api/scenarios?projectId=${projectId}`)
          .then(r => r.json())
          .then((all: Scenario[]) => {
            const sc = all.find(x => x.id === s.scenarioId)
            if (sc) setScenario(sc)
          })
      }
    })
  }, [projectId, sessionId, router])

  // Elapsed timer
  useEffect(() => {
    if (!session) return
    const iv = setInterval(() => setElapsed(elapsed(session.startedAt)), 1000)
    return () => clearInterval(iv)
  }, [session])

  // Flush events to API (batched)
  const flushEvents = useCallback(async (newEvents: PathEvent[]) => {
    if (!sessionId || !newEvents.length) return
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: newEvents }),
    })
  }, [sessionId])

  const scheduleFlush = useCallback(() => {
    if (pendingFlushRef.current) clearTimeout(pendingFlushRef.current)
    pendingFlushRef.current = setTimeout(() => {
      const events = eventsRef.current.splice(0)
      if (events.length) flushEvents(events)
    }, 2000)
  }, [flushEvents])

  // Inject overlay into iframe
  const injectOverlay = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    try {
      const doc = iframe.contentDocument
      if (!doc) return
      // Prevent double-injection
      if ((iframe.contentWindow as unknown as Record<string, unknown>)?.__argusInjected) return
      const script = doc.createElement('script')
      script.textContent = OVERLAY_SCRIPT
      doc.head.appendChild(script)
      // Send init after a tick
      setTimeout(() => {
        iframe.contentWindow?.postMessage({
          type: 'argus:init',
          tasks: scenario?.tasks ?? [],
        }, '*')
      }, 100)
    } catch (err) {
      console.warn('Overlay injection failed (cross-origin?):', err)
    }
  }, [scenario])

  const onIframeLoad = useCallback(() => {
    injectOverlay()
  }, [injectOverlay])

  // Listen for overlay messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data
      if (!data?.type?.startsWith('argus:')) return

      switch (data.type) {
        case 'argus:ready':
          // Re-send init in case overlay loaded before scenario was fetched
          iframeRef.current?.contentWindow?.postMessage({
            type: 'argus:init',
            tasks: scenario?.tasks ?? [],
          }, '*')
          break

        case 'argus:path': {
          const ev: PathEvent = data.event
          eventsRef.current.push(ev)
          scheduleFlush()
          break
        }

        case 'argus:comment':
          if (!sessionId || !projectId) break
          setCommentCount(c => c + 1)
          fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              projectId,
              text: data.text,
              selector: data.selector,
              rect: data.rect,
              pageUrl: data.pageUrl,
            }),
          })
          break

        case 'argus:task_complete':
          setCompletedTasks(prev => new Set([...prev, data.taskIndex as number]))
          // Persist completed tasks
          fetch(`/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              completedTasks: [...completedTasks, data.taskIndex as number],
            }),
          })
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [sessionId, projectId, scenario, scheduleFlush, completedTasks])

  async function endSession() {
    setEnding(true)
    // Flush remaining events
    const remaining = eventsRef.current.splice(0)
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: remaining,
        endedAt: new Date().toISOString(),
        completedTasks: [...completedTasks],
      }),
    })
    setEnded(true)
    setEnding(false)
  }

  const protoSrc = project
    ? `/serve/${projectId}/${project.uploadPath ? project.uploadPath + '/' : ''}${project.entryPath}`
    : ''

  if (ended) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-center p-6">
        <div className="text-5xl">🎉</div>
        <h2 className="text-white font-bold text-xl">Session complete</h2>
        <p className="text-gray-500 text-sm">Thank you! Your session has been saved.</p>
        <div className="flex gap-3 mt-4 text-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-gray-400">
            {commentCount} comment{commentCount !== 1 ? 's' : ''} pinned
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 text-gray-400">
            {completedTasks.size} task{completedTasks.size !== 1 ? 's' : ''} completed
          </div>
        </div>
        <button
          onClick={() => window.close()}
          className="mt-2 text-gray-600 hover:text-white text-sm transition-colors"
        >
          Close window
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-gray-400">Recording · {elapsed_}</span>
        </div>
        {scenario && (
          <div className="flex-1 text-xs text-gray-600 truncate">
            Scenario: {scenario.title}
            {scenario.tasks.length > 0 && (
              <span className="ml-2 text-indigo-400">{completedTasks.size}/{scenario.tasks.length} tasks</span>
            )}
          </div>
        )}
        {!scenario && <div className="flex-1" />}
        {commentCount > 0 && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <span>📌</span> {commentCount}
          </div>
        )}
        <button
          onClick={endSession}
          disabled={ending}
          className="bg-red-700/70 hover:bg-red-600 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-md font-medium transition-colors"
        >
          {ending ? 'Ending…' : 'End session'}
        </button>
      </div>

      {/* Prototype iframe */}
      <div className="flex-1 relative overflow-hidden">
        {protoSrc ? (
          <iframe
            ref={iframeRef}
            src={protoSrc}
            onLoad={onIframeLoad}
            className="w-full h-full border-none"
            title="Prototype"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">Loading prototype…</div>
        )}
      </div>
    </div>
  )
}
