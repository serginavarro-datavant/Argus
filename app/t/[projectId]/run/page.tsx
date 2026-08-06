'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import type { Project, Session, Scenario } from '@/lib/types'
import { ArgusLogo } from '@/components/ArgusLogo'
import { TaskBar } from '@/lib/overlay/taskBar'
import { mountCommentLayer, type Pin, type CommentLayerHandle } from '@/lib/overlay/commentLayer'
import { attachRecorder, type RecorderHandle, type PathEvent } from '@/lib/overlay/recorder'

type Phase = 'loading' | 'testing' | 'rating' | 'done'

interface TaskState {
  completed: boolean
  timeMs: number
  pathSlice: PathEvent[]
}

export default function TesterRunPage() {
  const params = useParams<{ projectId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = params.projectId
  const sessionId = searchParams.get('sessionId')

  // Overlay refs — never trigger re-renders
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const layerRef = useRef<CommentLayerHandle | null>(null)
  const recorderRef = useRef<RecorderHandle | null>(null)
  const allPathRef = useRef<PathEvent[]>([])
  const taskStartRef = useRef<Date>(new Date())
  const taskStartIdxRef = useRef(0)
  const taskIdxRef = useRef(0)
  const scenarioRef = useRef<Scenario | null>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [project, setProject] = useState<Project | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [taskIdx, setTaskIdx] = useState(0)
  const [taskStartedAt, setTaskStartedAt] = useState(() => new Date())
  const [commentMode, setCommentMode] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [taskStates, setTaskStates] = useState<Record<number, TaskState>>({})
  const [seq, setSeq] = useState(4)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load project + session
  useEffect(() => {
    if (!sessionId) { router.replace(`/t/${projectId}`); return }
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch(`/api/sessions/${sessionId}`).then(r => r.json()),
    ]).then(([p, s]: [Project, Session]) => {
      setProject(p)
      setSession(s)
      if (s.scenarioId) {
        fetch(`/api/scenarios?projectId=${projectId}`)
          .then(r => r.json())
          .then((all: Scenario[]) => {
            const sc = all.find(x => x.id === s.scenarioId) ?? null
            scenarioRef.current = sc
            setScenario(sc)
            setPhase('testing')
          })
      } else {
        setPhase('testing')
      }
    })
  }, [projectId, sessionId, router])

  // Setup overlay when iframe loads
  const setupOverlay = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    layerRef.current?.destroy()
    recorderRef.current?.detach()

    recorderRef.current = attachRecorder(iframe, (e) => {
      allPathRef.current.push(e)
    })

    const layer = mountCommentLayer(iframe, {
      onPin: (pin) => setPins(prev => [...prev, pin]),
    })
    layerRef.current = layer
  }, [])

  // Sync comment mode into layer
  useEffect(() => {
    layerRef.current?.setEnabled(commentMode)
  }, [commentMode])

  // Complete or abandon the current task, advance to next or go to rating
  const handleTaskComplete = useCallback((completed: boolean) => {
    const currentIdx = taskIdxRef.current
    const timeMs = Date.now() - taskStartRef.current.getTime()
    const pathSlice = allPathRef.current.slice(taskStartIdxRef.current)

    setTaskStates(prev => ({ ...prev, [currentIdx]: { completed, timeMs, pathSlice } }))

    const tasks = scenarioRef.current?.tasks ?? []
    if (currentIdx >= tasks.length - 1) {
      setPhase('rating')
    } else {
      const newStart = new Date()
      taskStartRef.current = newStart
      taskStartIdxRef.current = allPathRef.current.length
      taskIdxRef.current = currentIdx + 1
      setTaskIdx(currentIdx + 1)
      setTaskStartedAt(newStart)
    }
  }, [])

  async function handleSubmit() {
    if (!sessionId || !projectId) return
    setSubmitting(true)
    try {
      const tasks = scenarioRef.current?.tasks ?? []

      // Post per-task results
      for (let i = 0; i < tasks.length; i++) {
        const state = taskStates[i]
        if (!state) continue
        await fetch(`/api/sessions/${sessionId}/results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskIndex: i,
            completed: state.completed,
            timeMs: state.timeMs,
            rating: { clickCount: state.pathSlice.filter(e => e.type === 'click').length },
          }),
        })
      }

      // Post session-level rating (taskIndex -1 = whole-session)
      await fetch(`/api/sessions/${sessionId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskIndex: -1,
          completed: true,
          rating: { seq },
          note: note.trim() || undefined,
        }),
      })

      // Post all pinned comments
      for (const pin of pins) {
        await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            projectId,
            text: pin.text,
            selector: pin.selector,
            rect: pin.rect,
            pageUrl: pin.pageUrl,
            ox: pin.fractX,
            oy: pin.fractY,
            label: '',
            screen: pin.pageUrl,
            scenarioId: session?.scenarioId ?? null,
          }),
        })
      }

      // End session with full path
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: allPathRef.current,
          endedAt: new Date().toISOString(),
        }),
      })

      setPhase('done')
    } catch (err) {
      console.error('Submit failed:', err)
      setSubmitting(false)
    }
  }

  const protoSrc = project
    ? `/serve/${projectId}/${[project.uploadPath, project.entryPath].filter(Boolean).join('/')}`
    : ''

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0b13' }}>
        <div className="text-sm" style={{ color: '#3a3a52' }}>Loading session…</div>
      </div>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const completedCount = Object.values(taskStates).filter(t => t.completed).length
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center p-6" style={{ background: '#0b0b13' }}>
        <ArgusLogo size={40} />
        <h2 className="text-white font-bold text-xl mt-2">Session complete</h2>
        <p className="text-sm" style={{ color: '#5c5c78' }}>Thank you — your feedback has been saved.</p>
        <div className="flex gap-3 mt-2 text-sm">
          <div className="rounded-lg px-4 py-2" style={{ background: '#111119', border: '1px solid #1c1c2b', color: '#5c5c78' }}>
            {pins.length} comment{pins.length !== 1 ? 's' : ''} pinned
          </div>
          <div className="rounded-lg px-4 py-2" style={{ background: '#111119', border: '1px solid #1c1c2b', color: '#5c5c78' }}>
            {completedCount} task{completedCount !== 1 ? 's' : ''} completed
          </div>
        </div>
        <button
          onClick={() => window.close()}
          className="mt-2 text-sm transition-colors hover:text-white"
          style={{ color: '#3a3a52' }}
        >
          Close window
        </button>
      </div>
    )
  }

  // ── Rating ───────────────────────────────────────────────────────────────────
  if (phase === 'rating') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0b0b13' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center"><ArgusLogo size={32} /></div>
            <h2 className="text-white font-bold text-lg mt-4">Almost done</h2>
            <p className="text-sm mt-1" style={{ color: '#5c5c78' }}>Last step — a quick rating.</p>
          </div>
          <div className="rounded-2xl p-6 space-y-6" style={{ background: '#0e0e18', border: '1px solid #1c1c2b' }}>
            {/* SEQ */}
            <div>
              <p className="text-white text-sm font-medium mb-4">
                Overall, how easy was it to complete these tasks?
              </p>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <button
                    key={n}
                    onClick={() => setSeq(n)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                      background: seq === n ? '#5046e5' : '#111119',
                      border: `1px solid ${seq === n ? '#5046e5' : '#1c1c2b'}`,
                      color: seq === n ? '#fff' : '#5c5c78',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs mt-2" style={{ color: '#3a3a52' }}>
                <span>Very difficult</span>
                <span>Very easy</span>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#5c5c78' }}>
                Any other thoughts? (optional)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="What worked well, what felt confusing…"
                rows={3}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none resize-none transition-colors"
                style={{ background: '#13131e', border: '1px solid #1c1c2b' }}
                onFocus={e => (e.target.style.borderColor = '#5046e5')}
                onBlur={e => (e.target.style.borderColor = '#1c1c2b')}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-all disabled:opacity-50"
              style={{ background: '#5046e5' }}
            >
              {submitting ? 'Saving…' : 'Submit feedback →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Testing ───────────────────────────────────────────────────────────────────
  const tasks = scenario?.tasks ?? []

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0b0b13' }}>
      {/* Top bar */}
      <div
        className="flex-shrink-0 h-10 flex items-center px-4 gap-3"
        style={{ background: '#0e0e18', borderBottom: '1px solid #1c1c2b' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs" style={{ color: '#5c5c78' }}>Recording</span>
        </div>
        {scenario && (
          <span className="flex-1 text-xs truncate" style={{ color: '#3a3a52' }}>
            {scenario.title}
          </span>
        )}
        {!scenario && <div className="flex-1" />}
        {pins.length > 0 && (
          <span className="text-xs" style={{ color: '#3a3a52' }}>
            📌 {pins.length}
          </span>
        )}
        {tasks.length === 0 && (
          <button
            onClick={() => setPhase('rating')}
            className="text-xs px-3 py-1 rounded-md font-medium transition-colors"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
          >
            End session
          </button>
        )}
      </div>

      {/* Task bar */}
      {tasks.length > 0 && (
        <div className="flex-shrink-0">
          <TaskBar
            tasks={tasks}
            currentTaskIdx={taskIdx}
            startedAt={taskStartedAt}
            commentMode={commentMode}
            onToggleComment={() => setCommentMode(m => !m)}
            onTaskDone={() => handleTaskComplete(true)}
            onStuck={() => handleTaskComplete(false)}
          />
        </div>
      )}

      {/* Prototype iframe */}
      <div className="flex-1 relative overflow-hidden">
        {protoSrc ? (
          <iframe
            ref={iframeRef}
            src={protoSrc}
            onLoad={setupOverlay}
            className="w-full h-full border-0"
            title="Prototype"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: '#3a3a52' }}>
            Loading prototype…
          </div>
        )}
      </div>
    </div>
  )
}
