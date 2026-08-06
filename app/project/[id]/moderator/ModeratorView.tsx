'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Project, Session, Comment, Scenario, TaskResult } from '@/lib/types'
import { elapsed, formatDate } from '@/lib/utils'
import { mountReadOnlyLayer, type ReadOnlyPin, type ReadOnlyLayerHandle } from '@/lib/overlay/commentLayer'

// ── Palette ────────────────────────────────────────────────────────────────────
const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

type Tab = 'funnel' | 'comments' | 'metrics'

interface Props {
  project: Project
  initialSessions: Session[]
  initialScenarios: Scenario[]
  initialComments: Comment[]
  initialTaskResults: TaskResult[]
}

export default function ModeratorView({ project, initialSessions, initialScenarios, initialComments, initialTaskResults }: Props) {
  const [scenarioFilter, setScenarioFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [tab, setTab] = useState<Tab>('funnel')

  const scenarioMap = useMemo(() => Object.fromEntries(initialScenarios.map(s => [s.id, s])), [initialScenarios])

  // Sessions matching the scenario filter
  const visibleSessions = useMemo(() =>
    scenarioFilter === 'all'
      ? initialSessions
      : initialSessions.filter(s => s.scenarioId === scenarioFilter),
    [initialSessions, scenarioFilter],
  )

  // Sessions after user filter
  const filteredSessions = useMemo(() =>
    userFilter === 'all' ? visibleSessions : visibleSessions.filter(s => s.id === userFilter),
    [visibleSessions, userFilter],
  )

  const filteredSessionIds = useMemo(() => new Set(filteredSessions.map(s => s.id)), [filteredSessions])

  const filteredComments = useMemo(() =>
    initialComments.filter(c => filteredSessionIds.has(c.sessionId)),
    [initialComments, filteredSessionIds],
  )

  const filteredTaskResults = useMemo(() =>
    initialTaskResults.filter(r => filteredSessionIds.has(r.sessionId)),
    [initialTaskResults, filteredSessionIds],
  )

  const activeScenario = scenarioFilter !== 'all' ? (scenarioMap[scenarioFilter] ?? null) : null

  const colorFor = useCallback((sessionId: string) => {
    const idx = initialSessions.findIndex(s => s.id === sessionId)
    return USER_COLORS[idx % USER_COLORS.length]
  }, [initialSessions])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: S.bg }}>
      {/* ── Left sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r overflow-hidden" style={{ background: S.surface, borderColor: S.border }}>
        {/* Scenario picker */}
        <div className="px-4 py-3 border-b" style={{ borderColor: S.border }}>
          <label className="block text-xs mb-1.5" style={{ color: S.muted }}>Scenario</label>
          <select
            value={scenarioFilter}
            onChange={e => { setScenarioFilter(e.target.value); setUserFilter('all') }}
            className="w-full text-xs rounded-lg px-2.5 py-2 outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
          >
            <option value="all">All sessions ({initialSessions.length})</option>
            {initialScenarios.map(sc => (
              <option key={sc.id} value={sc.id}>{sc.title} ({initialSessions.filter(s => s.scenarioId === sc.id).length})</option>
            ))}
          </select>
        </div>

        {/* User filter */}
        <div className="px-4 py-2 border-b" style={{ borderColor: S.border }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: S.muted }}>Users</span>
            <span className="text-xs" style={{ color: S.dim }}>{visibleSessions.length}</span>
          </div>
          <button
            onClick={() => setUserFilter('all')}
            className="w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors mb-0.5"
            style={{ background: userFilter === 'all' ? 'rgba(80,70,229,0.15)' : 'transparent', color: userFilter === 'all' ? '#818cf8' : S.muted }}
          >
            All users
          </button>
          {visibleSessions.map(s => (
            <button
              key={s.id}
              onClick={() => setUserFilter(s.id === userFilter ? 'all' : s.id)}
              className="w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center gap-2"
              style={{ background: userFilter === s.id ? 'rgba(80,70,229,0.1)' : 'transparent' }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: colorFor(s.id) }}
              />
              <span className="flex-1 text-xs truncate" style={{ color: userFilter === s.id ? '#e0e7ff' : S.muted }}>
                {s.testerName}
              </span>
              {s.endedAt
                ? <span className="text-[10px] flex-shrink-0" style={{ color: '#34d399' }}>✓</span>
                : <span className="text-[10px] flex-shrink-0" style={{ color: '#fbbf24' }}>…</span>}
            </button>
          ))}
        </div>

        {/* Session summary */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {filteredSessions.map(s => {
            const sc = s.scenarioId ? scenarioMap[s.scenarioId] : null
            const commentCount = initialComments.filter(c => c.sessionId === s.id).length
            const results = initialTaskResults.filter(r => r.sessionId === s.id && r.taskIndex >= 0)
            const completedCount = results.filter(r => r.completed).length
            const seqResult = initialTaskResults.find(r => r.sessionId === s.id && r.taskIndex === -1)
            const seq = (seqResult?.rating as Record<string, unknown> | undefined)?.seq as number | undefined
            return (
              <div key={s.id} className="rounded-xl p-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white" style={{ background: colorFor(s.id) }}>
                    {s.testerName.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-xs font-medium truncate flex-1" style={{ color: '#e0e7ff' }}>{s.testerName}</span>
                  {seq !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(80,70,229,0.2)', color: '#818cf8' }}>
                      SEQ {seq}/7
                    </span>
                  )}
                </div>
                {sc && <div className="text-[10px] mb-1.5 truncate" style={{ color: '#818cf8' }}>{sc.title}</div>}
                <div className="flex gap-3 text-[10px]" style={{ color: S.dim }}>
                  {s.endedAt && <span>{elapsed(s.startedAt, s.endedAt)}</span>}
                  {results.length > 0 && <span>{completedCount}/{results.length} tasks</span>}
                  {commentCount > 0 && <span>📌 {commentCount}</span>}
                </div>
              </div>
            )
          })}
          {filteredSessions.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: S.dim }}>No sessions yet.</p>
          )}
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex-shrink-0 flex items-center gap-1 px-5 py-3 border-b" style={{ borderColor: S.border }}>
          {(['funnel', 'comments', 'metrics'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-all"
              style={{
                background: tab === t ? 'rgba(80,70,229,0.18)' : 'transparent',
                color: tab === t ? '#818cf8' : S.muted,
                border: `1px solid ${tab === t ? '#4f46e5' : 'transparent'}`,
              }}
            >
              {t === 'funnel' ? 'Funnel' : t === 'comments' ? 'Comments' : 'Metrics'}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs" style={{ color: S.dim }}>
            {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
            {userFilter !== 'all' ? ' · 1 user' : ''}
          </span>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
          {tab === 'funnel' && (
            <FunnelTab
              sessions={filteredSessions}
              scenario={activeScenario}
              taskResults={filteredTaskResults}
            />
          )}
          {tab === 'comments' && (
            <CommentsTab
              project={project}
              comments={filteredComments}
              sessions={filteredSessions}
              colorFor={colorFor}
            />
          )}
          {tab === 'metrics' && (
            <MetricsTab
              sessions={filteredSessions}
              scenarios={initialScenarios}
              scenarioFilter={scenarioFilter}
              taskResults={filteredTaskResults}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Funnel tab ─────────────────────────────────────────────────────────────────

function FunnelTab({ sessions, scenario, taskResults }: {
  sessions: Session[]
  scenario: Scenario | null
  taskResults: TaskResult[]
}) {
  const total = sessions.length

  // Navigation URL frequency
  const urlCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>()
    for (const s of sessions) {
      for (const ev of s.path) {
        if (ev.type !== 'navigation' || !ev.url) continue
        const path = ev.url.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') || '/'
        if (!counts.has(path)) counts.set(path, new Set())
        counts.get(path)!.add(s.id)
      }
    }
    return [...counts.entries()]
      .map(([url, sids]) => ({ url, count: sids.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [sessions])

  if (total === 0) {
    return <Empty label="No sessions to show a funnel." />
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Task completion funnel */}
      {scenario && scenario.tasks.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-white mb-1">{scenario.title}</h3>
          <p className="text-xs mb-5" style={{ color: S.muted }}>Task completion funnel — {total} session{total !== 1 ? 's' : ''}</p>
          <div className="space-y-3">
            {scenario.tasks.map((task, i) => {
              const results = taskResults.filter(r => r.taskIndex === i)
              const completed = results.filter(r => r.completed).length
              const attempted = results.length
              const pct = attempted ? Math.round(completed / attempted * 100) : (total > 0 ? 0 : null)
              const prevResults = i > 0 ? taskResults.filter(r => r.taskIndex === i - 1) : null
              const prevAttempted = prevResults?.length ?? total
              const dropOff = prevAttempted > 0 && attempted < prevAttempted
                ? Math.round((prevAttempted - attempted) / prevAttempted * 100)
                : null

              return (
                <div key={task.id}>
                  {dropOff !== null && dropOff > 0 && (
                    <div className="flex items-center gap-2 mb-1 pl-2">
                      <span className="text-[10px]" style={{ color: '#f87171' }}>↓ {dropOff}% dropped off</span>
                    </div>
                  )}
                  <div className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 text-white"
                          style={{ background: pct !== null && pct >= 60 ? '#059669' : pct !== null && pct >= 30 ? '#d97706' : '#dc2626' }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm text-white truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                        <span className="text-xs font-semibold" style={{ color: '#e0e7ff' }}>
                          {completed}/{attempted || total}
                        </span>
                        {pct !== null && (
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{
                              background: pct >= 60 ? 'rgba(5,150,105,0.15)' : pct >= 30 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
                              color: pct >= 60 ? '#34d399' : pct >= 30 ? '#fbbf24' : '#f87171',
                            }}
                          >
                            {pct}%
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="rounded-full overflow-hidden h-1.5" style={{ background: S.border }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct ?? 0}%`,
                          background: pct !== null && pct >= 60 ? '#059669' : pct !== null && pct >= 30 ? '#d97706' : '#dc2626',
                        }}
                      />
                    </div>
                    {task.description && (
                      <p className="text-xs mt-2 line-clamp-1" style={{ color: S.dim }}>{task.description}</p>
                    )}
                    {/* Per-user dots */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sessions.map(s => {
                        const r = taskResults.find(r => r.sessionId === s.id && r.taskIndex === i)
                        const color = r?.completed ? '#34d399' : r ? '#f87171' : S.border
                        return (
                          <span
                            key={s.id}
                            title={`${s.testerName}: ${r?.completed ? 'completed' : r ? 'stuck' : 'no data'}`}
                            className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: color }}
                          >
                            {s.testerName.charAt(0).toUpperCase()}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Navigation URL frequency */}
      {urlCounts.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-white mb-1">Page visits</h3>
          <p className="text-xs mb-4" style={{ color: S.muted }}>Unique screens visited across all sessions</p>
          <div className="space-y-2">
            {urlCounts.map(({ url, count }) => (
              <div key={url} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono truncate" style={{ color: '#94a3b8' }}>{url}</span>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: S.muted }}>{count}/{total}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: S.border }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(count / total * 100)}%`, background: '#4f46e5' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!scenario && urlCounts.length === 0 && (
        <Empty label="No navigation data recorded yet." />
      )}
    </div>
  )
}

// ── Comments tab ───────────────────────────────────────────────────────────────

function CommentsTab({ project, comments, sessions, colorFor }: {
  project: Project
  comments: Comment[]
  sessions: Session[]
  colorFor: (id: string) => string
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const layerRef = useRef<ReadOnlyLayerHandle | null>(null)
  const pinsRef = useRef<ReadOnlyPin[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const protoSrc = `/serve/${project.id}/${[project.uploadPath, project.entryPath].filter(Boolean).join('/')}`

  const pins: ReadOnlyPin[] = useMemo(() =>
    comments.map((c, i) => ({
      id: c.id,
      selector: c.selector,
      fractX: c.ox ?? 0.5,
      fractY: c.oy ?? 0.5,
      text: c.text,
      pageUrl: c.screen || c.pageUrl,
      color: colorFor(c.sessionId),
      number: i + 1,
    })),
    [comments, colorFor],
  )

  const setupLayer = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    layerRef.current?.destroy()
    layerRef.current = mountReadOnlyLayer(iframe, { onPinClick: setActiveId })
    layerRef.current.setPins(pinsRef.current)
  }, [])

  // Sync pins into layer whenever they change
  useEffect(() => {
    pinsRef.current = pins
    layerRef.current?.setPins(pins)
  }, [pins])

  // Poll iframe URL → reposition so dots show/hide as user navigates
  useEffect(() => {
    const iv = setInterval(() => layerRef.current?.reposition(), 600)
    return () => clearInterval(iv)
  }, [])

  // Cleanup on unmount
  useEffect(() => () => { layerRef.current?.destroy() }, [])

  const activeComment = activeId ? comments.find(c => c.id === activeId) : null
  const activeSession = activeComment ? sessions.find(s => s.id === activeComment.sessionId) : null

  if (comments.length === 0) {
    return <Empty label="No comments pinned in this view." />
  }

  return (
    // Iframe fills all available space; comment panel floats over the right edge
    <div className="relative h-full overflow-hidden" style={{ background: '#000' }}>
      <iframe
        ref={iframeRef}
        src={protoSrc}
        onLoad={setupLayer}
        className="w-full h-full border-0"
        title="Prototype preview"
      />

      {/* Floating comment panel */}
      <aside
        className="absolute top-0 right-0 bottom-0 w-64 flex flex-col overflow-hidden"
        style={{ background: 'rgba(14,14,24,0.96)', borderLeft: `1px solid ${S.border}` }}
      >
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: S.border }}>
          <h3 className="text-sm font-medium text-white">Comments</h3>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>
            {comments.length} pinned · navigate to filter by screen
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {comments.map((c, i) => {
            const session = sessions.find(s => s.id === c.sessionId)
            const isActive = activeId === c.id
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(isActive ? null : c.id)}
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
                  <span className="text-[10px] flex-1 truncate" style={{ color: S.muted }}>
                    {session?.testerName ?? 'Unknown'}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: S.dim }}>
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: '#e0e7ff' }}>{c.text}</p>
                {isActive && (
                  <div className="mt-2 pt-2 space-y-1" style={{ borderTop: `1px solid ${S.border}` }}>
                    {c.selector && (
                      <code className="block text-[10px] truncate font-mono" style={{ color: S.dim }}>{c.selector}</code>
                    )}
                    {(c.screen || c.pageUrl) && (
                      <code className="block text-[10px] truncate font-mono" style={{ color: S.dim }}>{c.screen || c.pageUrl}</code>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

// ── Metrics tab ────────────────────────────────────────────────────────────────

function MetricsTab({ sessions, scenarios, scenarioFilter, taskResults }: {
  sessions: Session[]
  scenarios: Scenario[]
  scenarioFilter: string
  taskResults: TaskResult[]
}) {
  const total = sessions.length
  const scenario = scenarioFilter !== 'all' ? scenarios.find(s => s.id === scenarioFilter) : null

  // Session-level SEQ ratings
  const seqResults = taskResults.filter(r => r.taskIndex === -1 && (r.rating as Record<string, unknown>)?.seq !== undefined)
  const avgSeq = seqResults.length
    ? (seqResults.reduce((a, r) => a + ((r.rating as Record<string, unknown>).seq as number), 0) / seqResults.length).toFixed(1)
    : null

  if (total === 0) return <Empty label="No sessions to compute metrics." />

  const completedSessions = sessions.filter(s => s.endedAt)
  const avgDurationMs = completedSessions.length
    ? completedSessions.reduce((acc, s) => acc + (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()), 0) / completedSessions.length
    : null

  function fmtMs(ms: number | null): string {
    if (ms === null) return '—'
    const s = Math.round(ms / 1000)
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Top-level KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Sessions', value: total },
          { label: 'Completed', value: completedSessions.length, sub: total ? `${Math.round(completedSessions.length / total * 100)}%` : '—' },
          { label: 'Avg duration', value: fmtMs(avgDurationMs) },
          { label: 'Avg SEQ', value: avgSeq !== null ? `${avgSeq}/7` : '—', sub: `${seqResults.length} ratings` },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-4" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="text-xl font-bold text-white">{kpi.value}</div>
            {kpi.sub && <div className="text-xs mt-0.5" style={{ color: '#818cf8' }}>{kpi.sub}</div>}
            <div className="text-xs mt-1" style={{ color: S.muted }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Per-task breakdown */}
      {scenario && scenario.tasks.length > 0 && (
        <section className="mb-8">
          <h3 className="text-sm font-semibold text-white mb-4">Task breakdown — {scenario.title}</h3>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                  {['Task', 'Attempted', 'Completed', 'Success', 'Avg time', 'Fastest', 'Avg clicks'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenario.tasks.map((task, i) => {
                  const results = taskResults.filter(r => r.taskIndex === i)
                  const attempted = results.length
                  const completed = results.filter(r => r.completed).length
                  const pct = attempted ? Math.round(completed / attempted * 100) : null
                  const timings = results.map(r => (r.rating as Record<string, unknown>)?.timeMs as number).filter(Boolean)
                  const avgTime = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : null
                  const fastest = timings.length ? Math.min(...timings) : null
                  const clicks = results.map(r => (r.rating as Record<string, unknown>)?.clickCount as number).filter(Boolean)
                  const avgClicks = clicks.length ? (clicks.reduce((a, b) => a + b, 0) / clicks.length).toFixed(1) : null

                  return (
                    <tr
                      key={task.id}
                      style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.surface : 'transparent' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ background: `rgba(80,70,229,0.4)` }}
                          >
                            {i + 1}
                          </span>
                          <span style={{ color: '#e0e7ff' }}>{task.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: S.muted }}>{attempted || 0}</td>
                      <td className="px-4 py-3">
                        <span style={{ color: completed > 0 ? '#34d399' : S.muted }}>{completed}</span>
                      </td>
                      <td className="px-4 py-3">
                        {pct !== null
                          ? <PctBadge pct={pct} />
                          : <span style={{ color: S.dim }}>—</span>}
                      </td>
                      <td className="px-4 py-3" style={{ color: S.muted }}>{fmtMs(avgTime)}</td>
                      <td className="px-4 py-3" style={{ color: S.muted }}>{fmtMs(fastest)}</td>
                      <td className="px-4 py-3" style={{ color: S.muted }}>{avgClicks ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Per-user table */}
      <section>
        <h3 className="text-sm font-semibold text-white mb-4">Per-user summary</h3>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                {['User', 'Started', 'Duration', 'Tasks done', 'SEQ', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: S.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const userResults = taskResults.filter(r => r.sessionId === s.id && r.taskIndex >= 0)
                const tasksDone = userResults.filter(r => r.completed).length
                const seqR = taskResults.find(r => r.sessionId === s.id && r.taskIndex === -1)
                const seq = (seqR?.rating as Record<string, unknown> | undefined)?.seq as number | undefined
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.surface : 'transparent' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0" style={{ background: USER_COLORS[i % USER_COLORS.length] }}>
                          {s.testerName.charAt(0).toUpperCase()}
                        </span>
                        <span style={{ color: '#e0e7ff' }}>{s.testerName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: S.muted }}>{formatDate(s.startedAt)}</td>
                    <td className="px-4 py-3" style={{ color: S.muted }}>
                      {s.endedAt ? elapsed(s.startedAt, s.endedAt) : <span style={{ color: '#fbbf24' }}>ongoing</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: tasksDone > 0 ? '#34d399' : S.muted }}>
                      {userResults.length > 0 ? `${tasksDone}/${userResults.length}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {seq !== undefined
                        ? <span style={{ color: seq >= 5 ? '#34d399' : seq >= 3 ? '#fbbf24' : '#f87171' }}>{seq}/7</span>
                        : <span style={{ color: S.dim }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{
                        background: s.endedAt ? 'rgba(5,150,105,0.15)' : 'rgba(251,191,36,0.15)',
                        color: s.endedAt ? '#34d399' : '#fbbf24',
                      }}>
                        {s.endedAt ? 'Done' : 'In progress'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function PctBadge({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171'
  const bg = pct >= 70 ? 'rgba(5,150,105,0.15)' : pct >= 40 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)'
  return (
    <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>
      {pct}%
    </span>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: S.dim }}>{label}</p>
    </div>
  )
}
