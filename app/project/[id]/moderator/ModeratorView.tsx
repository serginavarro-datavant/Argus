'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Project, Session, Comment, Scenario, TaskResult, Persona, PathEvent } from '@/lib/types'
import { elapsed, formatDate } from '@/lib/utils'
import { mountReadOnlyLayer, type ReadOnlyPin, type ReadOnlyLayerHandle } from '@/lib/overlay/commentLayer'

// ── Palette ────────────────────────────────────────────────────────────────────
const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

type MainTab = 'users' | 'paths' | 'metrics' | 'comments'
type DetailTab = 'replay' | 'comments' | 'stats'

interface UserGroup {
  name: string
  sessions: Session[]
  isBot: boolean
  personaName?: string
  lastDate: string
  completionRate: number
  totalComments: number
}

interface Props {
  project: Project
  initialSessions: Session[]
  initialScenarios: Scenario[]
  initialComments: Comment[]
  initialTaskResults: TaskResult[]
  initialPersonas: Persona[]
}

export default function ModeratorView({ project, initialSessions, initialScenarios, initialComments, initialTaskResults, initialPersonas }: Props) {
  const [mainTab, setMainTab] = useState<MainTab>('users')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('replay')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [runningAI, setRunningAI] = useState(false)
  const [aiPersonaId, setAiPersonaId] = useState(initialPersonas[0]?.id ?? '')
  const [aiScenarioId, setAiScenarioId] = useState(initialScenarios[0]?.id ?? '')
  const [sessions, setSessions] = useState(initialSessions)
  const [taskResults, setTaskResults] = useState(initialTaskResults)
  const [comments, setComments] = useState(initialComments)

  const scenarioMap = useMemo(() => Object.fromEntries(initialScenarios.map(s => [s.id, s])), [initialScenarios])
  const personaMap  = useMemo(() => Object.fromEntries(initialPersonas.map(p => [p.id, p])), [initialPersonas])

  // Group sessions by testerName
  const userGroups = useMemo((): UserGroup[] => {
    const groups = new Map<string, Session[]>()
    for (const s of sessions) {
      if (!groups.has(s.testerName)) groups.set(s.testerName, [])
      groups.get(s.testerName)!.push(s)
    }
    return [...groups.entries()].map(([name, sArr]) => {
      const completed = sArr.filter(s => s.endedAt).length
      const pId = sArr.find(s => s.personaId)?.personaId
      return {
        name,
        sessions: sArr.sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
        isBot: sArr.some(s => (s as {type?: string}).type === 'bot'),
        personaName: pId ? personaMap[pId]?.name : undefined,
        lastDate: sArr.map(s => s.startedAt).sort().at(-1) ?? '',
        completionRate: sArr.length ? Math.round(completed / sArr.length * 100) : 0,
        totalComments: comments.filter(c => sArr.some(s => s.id === c.sessionId)).length,
      }
    }).sort((a, b) => b.lastDate.localeCompare(a.lastDate))
  }, [sessions, comments, personaMap])

  const selectedGroup = selectedUser ? userGroups.find(g => g.name === selectedUser) ?? null : null

  const colorFor = useCallback((sessionId: string) => {
    const idx = sessions.findIndex(s => s.id === sessionId)
    return USER_COLORS[idx % USER_COLORS.length]
  }, [sessions])

  async function runAISession() {
    if (!aiPersonaId || !aiScenarioId) return
    setRunningAI(true)
    try {
      const res = await fetch('/api/agent/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personaId: aiPersonaId, scenarioId: aiScenarioId, projectId: project.id }),
      })
      if (!res.ok) throw new Error(await res.text())
      // Reload page to pick up new session
      window.location.reload()
    } catch (err) {
      alert(`AI simulation failed: ${err}`)
    } finally {
      setRunningAI(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: S.bg }}>
      {/* ── Left sidebar ─────────────────────────────────────────── */}
      <aside className="flex-shrink-0 flex flex-col border-r overflow-hidden" style={{ width: 272, background: S.surface, borderColor: S.border }}>

        {/* Header */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: S.border }}>
          <div className="text-sm font-semibold text-white mb-0.5">{project.name}</div>
          <div className="text-xs" style={{ color: S.dim }}>
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} · {userGroups.length} user{userGroups.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Main tab switcher */}
        <div className="flex border-b flex-shrink-0" style={{ borderColor: S.border }}>
          {(['users', 'paths', 'metrics', 'comments'] as MainTab[]).map(t => (
            <button
              key={t}
              onClick={() => { setMainTab(t); setSelectedUser(null) }}
              className="flex-1 py-2 text-[10px] font-medium capitalize transition-colors"
              style={{ color: mainTab === t ? '#818cf8' : S.dim, borderBottom: mainTab === t ? '1.5px solid #4f46e5' : '1.5px solid transparent' }}
            >
              {t === 'users' ? 'Users' : t === 'paths' ? 'Paths' : t === 'metrics' ? 'Metrics' : 'Comments'}
            </button>
          ))}
        </div>

        {/* User list (always shown) */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {userGroups.map((g, i) => (
            <button
              key={g.name}
              onClick={() => { setSelectedUser(g.name); setMainTab('users'); setDetailTab('replay') }}
              className="w-full text-left rounded-xl p-3 transition-all"
              style={{
                background: selectedUser === g.name ? 'rgba(79,70,229,0.15)' : 'rgba(17,17,25,0.5)',
                border: `1px solid ${selectedUser === g.name ? '#4f46e5' : S.border}`,
              }}
            >
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: USER_COLORS[i % USER_COLORS.length] }}>
                  {g.name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white truncate">{g.name}</span>
                    {g.isBot && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                        AI
                      </span>
                    )}
                  </div>
                  {g.personaName && (
                    <div className="text-[10px] truncate" style={{ color: '#6366f1' }}>{g.personaName}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: S.dim }}>
                <span>{g.sessions.length} scenario{g.sessions.length !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span style={{ color: g.completionRate === 100 ? '#34d399' : g.completionRate > 0 ? '#fbbf24' : S.muted }}>
                  {g.completionRate}% done
                </span>
                {g.totalComments > 0 && <><span>·</span><span>📌 {g.totalComments}</span></>}
              </div>
            </button>
          ))}

          {userGroups.length === 0 && (
            <p className="text-xs text-center py-8" style={{ color: S.dim }}>No sessions yet.</p>
          )}
        </div>

        {/* AI Persona runner */}
        <div className="border-t p-3 flex-shrink-0 space-y-2" style={{ borderColor: S.border }}>
          <p className="text-[10px] font-medium" style={{ color: S.muted }}>Run AI persona simulation</p>
          <select value={aiPersonaId} onChange={e => setAiPersonaId(e.target.value)}
            className="w-full text-[10px] rounded-lg px-2 py-1.5 outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: '#e0e7ff' }}>
            {initialPersonas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={aiScenarioId} onChange={e => setAiScenarioId(e.target.value)}
            className="w-full text-[10px] rounded-lg px-2 py-1.5 outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: '#e0e7ff' }}>
            {initialScenarios.filter(s => !s.freeform).map(s => (
              <option key={s.id} value={s.id}>{s.title.slice(0, 40)}{s.title.length > 40 ? '…' : ''}</option>
            ))}
          </select>
          <button
            onClick={runAISession}
            disabled={runningAI || !aiPersonaId || !aiScenarioId}
            className="w-full py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
            style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            {runningAI ? 'Simulating…' : '🤖 Run simulation'}
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Session detail */}
        {selectedUser && selectedGroup ? (
          <SessionDetail
            group={selectedGroup}
            sessions={sessions}
            scenarioMap={scenarioMap}
            allComments={comments}
            taskResults={taskResults}
            project={project}
            colorFor={colorFor}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            onBack={() => setSelectedUser(null)}
          />
        ) : (
          <AggregateView
            tab={mainTab}
            sessions={sessions}
            scenarios={initialScenarios}
            comments={comments}
            taskResults={taskResults}
            project={project}
            colorFor={colorFor}
            selectedScenarioId={selectedScenarioId}
            setSelectedScenarioId={setSelectedScenarioId}
          />
        )}
      </div>
    </div>
  )
}

// ── Session detail ──────────────────────────────────────────────────────────────

function SessionDetail({ group, sessions, scenarioMap, allComments, taskResults, project, colorFor, detailTab, setDetailTab, onBack }: {
  group: UserGroup
  sessions: Session[]
  scenarioMap: Record<string, Scenario>
  allComments: Comment[]
  taskResults: TaskResult[]
  project: Project
  colorFor: (id: string) => string
  detailTab: DetailTab
  setDetailTab: (t: DetailTab) => void
  onBack: () => void
}) {
  const userSessions = group.sessions
  const userComments = allComments.filter(c => userSessions.some(s => s.id === c.sessionId))
  const userTaskResults = taskResults.filter(r => userSessions.some(s => s.id === r.sessionId))
  const completedSessions = userSessions.filter(s => s.endedAt)
  const seqResults = userTaskResults.filter(r => r.taskIndex === -1 && (r.rating as Record<string, unknown>)?.seq !== undefined)
  const avgSeq = seqResults.length
    ? (seqResults.reduce((a, r) => a + ((r.rating as Record<string, unknown>).seq as number), 0) / seqResults.length).toFixed(1)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: S.border }}>
        <button onClick={onBack} className="text-xs transition-colors hover:text-white" style={{ color: S.muted }}>← Back</button>
        <div className="w-px h-4" style={{ background: S.border }} />
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: colorFor(userSessions[0].id) }}>
            {group.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{group.name}</span>
              {group.isBot && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>AI</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px]" style={{ color: S.dim }}>
              <span>{userSessions.length} scenario{userSessions.length !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{group.completionRate}% complete</span>
              {avgSeq && <><span>·</span><span>SEQ {avgSeq}/7</span></>}
              {userComments.length > 0 && <><span>·</span><span>📌 {userComments.length} comments</span></>}
            </div>
          </div>
        </div>
        {/* Sub-tabs */}
        <div className="flex gap-1">
          {(['replay', 'comments', 'stats'] as DetailTab[]).map(t => (
            <button key={t} onClick={() => setDetailTab(t)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium capitalize transition-all"
              style={{
                background: detailTab === t ? 'rgba(79,70,229,0.18)' : 'transparent',
                color: detailTab === t ? '#818cf8' : S.muted,
                border: `1px solid ${detailTab === t ? '#4f46e5' : 'transparent'}`,
              }}>
              {t === 'replay' ? 'Replay' : t === 'comments' ? 'Comments' : 'Stats'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {detailTab === 'replay' && (
          <ReplayTab
            sessions={userSessions}
            scenarioMap={scenarioMap}
            comments={userComments}
            taskResults={userTaskResults}
            project={project}
          />
        )}
        {detailTab === 'comments' && (
          <CommentsTab
            project={project}
            comments={userComments}
            sessions={userSessions}
            colorFor={colorFor}
          />
        )}
        {detailTab === 'stats' && (
          <UserStatsTab
            sessions={userSessions}
            scenarioMap={scenarioMap}
            taskResults={userTaskResults}
          />
        )}
      </div>
    </div>
  )
}

// ── Replay tab ──────────────────────────────────────────────────────────────────

function ReplayTab({ sessions, scenarioMap, comments, taskResults, project }: {
  sessions: Session[]
  scenarioMap: Record<string, Scenario>
  comments: Comment[]
  taskResults: TaskResult[]
  project: Project
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(sessions[0]?.id ?? null)
  const [activeEventKey, setActiveEventKey] = useState<string | null>(null)

  const protoSrc = `/serve/${project.id}/${[project.uploadPath, project.entryPath].filter(Boolean).join('/')}`

  function navigateTo(url?: string) {
    if (!url || !iframeRef.current) return
    const path = url.replace(/^https?:\/\/[^/]+/, '') || '/'
    try {
      const cur = iframeRef.current.contentWindow?.location?.pathname ?? ''
      if (cur !== path.split('?')[0]) {
        iframeRef.current.contentWindow?.location.assign(path)
      }
    } catch { /* cross-origin */ }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: scenario/event timeline */}
      <div className="flex-shrink-0 overflow-y-auto" style={{ width: 340, borderRight: `1px solid ${S.border}` }}>
        {sessions.map(session => {
          const sc = session.scenarioId ? scenarioMap[session.scenarioId] : null
          const expanded = expandedSessionId === session.id
          const sessionComments = comments.filter(c => c.sessionId === session.id)
          const sessionResults = taskResults.filter(r => r.sessionId === session.id && r.taskIndex >= 0)
          const completed = sessionResults.filter(r => r.completed).length
          const duration = session.endedAt
            ? elapsed(session.startedAt, session.endedAt)
            : <span style={{ color: '#fbbf24' }}>dropped off</span>

          // Build merged timeline: path events + inline comments by approximate time
          const events = buildTimeline(session.path, sessionComments, sessionResults, session.startedAt)

          return (
            <div key={session.id} className="border-b" style={{ borderColor: S.border }}>
              {/* Scenario header */}
              <button
                onClick={() => setExpandedSessionId(expanded ? null : session.id)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-white/[0.02]"
              >
                <span className="text-xs mt-0.5" style={{ color: expanded ? '#818cf8' : S.dim }}>
                  {expanded ? '▾' : '▸'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-white truncate">
                      {sc?.title ?? 'Unknown scenario'}
                    </span>
                    {session.endedAt ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(5,150,105,0.15)', color: '#34d399' }}>✓</span>
                    ) : (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>dropped</span>
                    )}
                  </div>
                  <div className="text-[10px] flex gap-2" style={{ color: S.dim }}>
                    <span>{typeof duration === 'string' ? duration : ''}{typeof duration !== 'string' && duration}</span>
                    {sessionResults.length > 0 && <><span>·</span><span>{completed}/{sessionResults.length} tasks</span></>}
                    {sessionComments.length > 0 && <><span>·</span><span>📌 {sessionComments.length}</span></>}
                  </div>
                </div>
              </button>

              {/* Event timeline */}
              {expanded && (
                <div className="pb-3">
                  {events.map((ev, i) => {
                    const key = `${session.id}-${i}`
                    const isActive = activeEventKey === key
                    return (
                      <EventRow
                        key={key}
                        event={ev}
                        isActive={isActive}
                        onClick={() => {
                          setActiveEventKey(key)
                          navigateTo(ev.url)
                        }}
                      />
                    )
                  })}
                  {events.length === 0 && (
                    <p className="text-[10px] px-4 py-2" style={{ color: S.dim }}>No path events recorded.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right: iframe */}
      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b"
          style={{ background: S.surface, borderColor: S.border }}>
          <span className="text-xs font-medium text-white">Prototype preview</span>
          <a href={protoSrc} target="_blank" className="text-xs hover:text-white transition-colors" style={{ color: S.muted }}>
            Full screen ↗
          </a>
        </div>
        <div className="flex-1 min-h-0" style={{ background: '#0a0a0f' }}>
          <iframe ref={iframeRef} src={protoSrc} className="w-full h-full border-0" title="Prototype" />
        </div>
      </div>
    </div>
  )
}

// ── Timeline helpers ────────────────────────────────────────────────────────────

interface TimelineEvent {
  kind: 'navigation' | 'click' | 'task_start' | 'task_complete' | 'stuck' | 'comment'
  label: string
  url?: string
  selector?: string
  timestamp: string
  taskIndex?: number
}

function buildTimeline(
  path: PathEvent[],
  comments: Comment[],
  taskResults: TaskResult[],
  sessionStart: string
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const ev of path) {
    if (ev.type === 'task_complete') {
      const result = taskResults.find(r => r.taskIndex === ev.taskIndex)
      const completed = result?.completed ?? true
      events.push({
        kind: completed ? 'task_complete' : 'stuck',
        label: completed ? `Task ${(ev.taskIndex ?? 0) + 1} completed` : `Stuck on task ${(ev.taskIndex ?? 0) + 1}`,
        timestamp: ev.timestamp,
        taskIndex: ev.taskIndex,
      })
    } else {
      events.push({
        kind: ev.type as TimelineEvent['kind'],
        label: ev.label ?? (ev.type === 'navigation' ? ev.url ?? 'Navigated' : ev.selector ?? 'Clicked'),
        url: ev.url,
        selector: ev.selector,
        timestamp: ev.timestamp,
        taskIndex: ev.taskIndex,
      })
    }
  }

  // Inject comments inline at their approximate timestamp (put them after the session's last click)
  const commentEvents: TimelineEvent[] = comments.map(c => ({
    kind: 'comment' as const,
    label: c.text,
    url: c.pageUrl || c.screen,
    selector: c.selector,
    timestamp: c.createdAt,
  }))

  return [...events, ...commentEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

function EventRow({ event, isActive, onClick }: { event: TimelineEvent; isActive: boolean; onClick: () => void }) {
  const icons: Record<string, string> = {
    navigation: '📄',
    click: '👆',
    task_start: '▶',
    task_complete: '✅',
    stuck: '⚠️',
    comment: '📌',
  }
  const colors: Record<string, string> = {
    navigation: '#5c5c78',
    click: '#e0e7ff',
    task_start: '#818cf8',
    task_complete: '#34d399',
    stuck: '#fbbf24',
    comment: '#a78bfa',
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-2.5 px-4 py-2 transition-all hover:bg-white/[0.02]"
      style={{ background: isActive ? 'rgba(79,70,229,0.1)' : 'transparent' }}
    >
      <span className="text-xs mt-0.5 flex-shrink-0">{icons[event.kind] ?? '•'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] leading-snug"
          style={{ color: colors[event.kind] ?? '#e0e7ff', fontStyle: event.kind === 'comment' ? 'italic' : 'normal' }}>
          {event.kind === 'comment' ? `"${event.label}"` : event.label}
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: S.dim }}>
          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>
    </button>
  )
}

// ── Aggregate view (when no user selected) ──────────────────────────────────────

function AggregateView({ tab, sessions, scenarios, comments, taskResults, project, colorFor, selectedScenarioId, setSelectedScenarioId }: {
  tab: MainTab
  sessions: Session[]
  scenarios: Scenario[]
  comments: Comment[]
  taskResults: TaskResult[]
  project: Project
  colorFor: (id: string) => string
  selectedScenarioId: string | null
  setSelectedScenarioId: (id: string | null) => void
}) {
  if (tab === 'comments') {
    return <CommentsTab project={project} comments={comments} sessions={sessions} colorFor={colorFor} />
  }

  if (tab === 'paths') {
    return (
      <PathsTab
        sessions={sessions}
        scenarios={scenarios}
        taskResults={taskResults}
        selectedScenarioId={selectedScenarioId}
        setSelectedScenarioId={setSelectedScenarioId}
        colorFor={colorFor}
      />
    )
  }

  if (tab === 'metrics') {
    return <MetricsTab sessions={sessions} scenarios={scenarios} taskResults={taskResults} />
  }

  // Default: prompt to select a user
  const completedSessions = sessions.filter(s => s.endedAt)
  const totalComments = comments.length
  const completionRate = sessions.length ? Math.round(completedSessions.length / sessions.length * 100) : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8" style={{ color: S.muted }}>
      <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
        {[
          { label: 'Sessions', value: sessions.length, color: '#818cf8' },
          { label: 'Completion', value: `${completionRate}%`, color: completionRate >= 80 ? '#34d399' : '#fbbf24' },
          { label: 'Comments', value: totalComments, color: '#a78bfa' },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-4 text-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
            <div className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</div>
            <div className="text-xs mt-1" style={{ color: S.dim }}>{m.label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-center max-w-xs" style={{ color: S.dim }}>
        Select a user from the left panel to replay their session, or use the tabs above to explore paths, metrics, and comments.
      </p>
    </div>
  )
}

// ── Paths tab ───────────────────────────────────────────────────────────────────

function PathsTab({ sessions, scenarios, taskResults, selectedScenarioId, setSelectedScenarioId, colorFor }: {
  sessions: Session[]
  scenarios: Scenario[]
  taskResults: TaskResult[]
  selectedScenarioId: string | null
  setSelectedScenarioId: (id: string | null) => void
  colorFor: (id: string) => string
}) {
  const effectiveScenarioId = selectedScenarioId ?? scenarios[0]?.id ?? null
  const scenario = scenarios.find(s => s.id === effectiveScenarioId) ?? null
  const scenarioSessions = sessions.filter(s => s.scenarioId === effectiveScenarioId)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scenario picker */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: S.border }}>
        <span className="text-xs font-medium text-white">Scenario</span>
        <select
          value={effectiveScenarioId ?? ''}
          onChange={e => setSelectedScenarioId(e.target.value)}
          className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
          style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
        >
          {scenarios.map(sc => (
            <option key={sc.id} value={sc.id}>
              {sc.title} ({sessions.filter(s => s.scenarioId === sc.id).length} users)
            </option>
          ))}
        </select>
        <span className="text-xs" style={{ color: S.dim }}>{scenarioSessions.length} path{scenarioSessions.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {scenarioSessions.length === 0 ? (
          <Empty label="No sessions for this scenario yet." />
        ) : (
          <div className="space-y-4">
            {scenario && scenario.tasks.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white mb-1">{scenario.title}</h3>
                <p className="text-xs mb-4" style={{ color: S.muted }}>Side-by-side paths from all users for this scenario</p>

                {/* Parallel paths grid */}
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(scenarioSessions.length, 4)}, 1fr)` }}>
                  {scenarioSessions.slice(0, 4).map(session => {
                    const sessionResults = taskResults.filter(r => r.sessionId === session.id && r.taskIndex >= 0)
                    const completedCount = sessionResults.filter(r => r.completed).length
                    const color = colorFor(session.id)

                    const clickEvents = session.path.filter(e => e.type === 'click').length
                    const navEvents = session.path.filter(e => e.type === 'navigation').length

                    return (
                      <div key={session.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
                        {/* User header */}
                        <div className="px-3 py-2 flex items-center gap-2" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                            style={{ background: color }}>
                            {session.testerName.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-medium text-white truncate flex-1">{session.testerName}</span>
                          {session.endedAt
                            ? <span className="text-[9px]" style={{ color: '#34d399' }}>✓</span>
                            : <span className="text-[9px]" style={{ color: '#fbbf24' }}>dropped</span>}
                        </div>

                        {/* Compact path steps */}
                        <div className="p-2 space-y-1">
                          {scenario.tasks.map((task, idx) => {
                            const result = taskResults.find(r => r.sessionId === session.id && r.taskIndex === idx)
                            const didAttempt = result !== undefined
                            const completed = result?.completed ?? false
                            const timeMs = (result?.rating as Record<string,unknown>)?.timeMs as number | undefined

                            return (
                              <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                                style={{ background: completed ? 'rgba(5,150,105,0.08)' : didAttempt ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.02)' }}>
                                <span className="text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
                                  style={{ background: completed ? '#059669' : didAttempt ? '#dc2626' : S.border }}>
                                  {idx + 1}
                                </span>
                                <span className="text-[10px] flex-1 truncate" style={{ color: completed ? '#34d399' : didAttempt ? '#f87171' : S.dim }}>
                                  {task.title}
                                </span>
                                {timeMs && <span className="text-[9px] flex-shrink-0" style={{ color: S.dim }}>{Math.round(timeMs / 1000)}s</span>}
                              </div>
                            )
                          })}
                        </div>

                        {/* Footer stats */}
                        <div className="px-3 py-2 flex gap-3 text-[10px]" style={{ borderTop: `1px solid ${S.border}`, color: S.dim }}>
                          <span>{completedCount}/{sessionResults.length} tasks</span>
                          <span>{clickEvents} clicks</span>
                          {session.endedAt && <span>{elapsed(session.startedAt, session.endedAt)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Page visit frequency */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Page visits across all users</h3>
              <PathFrequency sessions={scenarioSessions} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PathFrequency({ sessions }: { sessions: Session[] }) {
  const total = sessions.length
  const urlCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>()
    for (const s of sessions) {
      for (const ev of s.path) {
        if (ev.type === 'click' && ev.label) {
          const label = ev.label
          if (!counts.has(label)) counts.set(label, new Set())
          counts.get(label)!.add(s.id)
        }
      }
    }
    return [...counts.entries()]
      .map(([label, sids]) => ({ label, count: sids.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [sessions])

  if (urlCounts.length === 0) return <p className="text-xs" style={{ color: S.dim }}>No click events recorded.</p>

  return (
    <div className="space-y-2">
      {urlCounts.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs truncate flex-1 min-w-0" style={{ color: '#94a3b8' }}>{label}</span>
          <span className="text-xs flex-shrink-0" style={{ color: S.muted }}>{count}/{total}</span>
          <div className="w-24 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: S.border }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(count / total * 100)}%`, background: '#4f46e5' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── User stats tab ──────────────────────────────────────────────────────────────

function UserStatsTab({ sessions, scenarioMap, taskResults }: {
  sessions: Session[]
  scenarioMap: Record<string, Scenario>
  taskResults: TaskResult[]
}) {
  function fmtMs(ms: number | null): string {
    if (ms === null) return '—'
    const s = Math.round(ms / 1000)
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      <div className="space-y-6">
        {sessions.map(session => {
          const sc = session.scenarioId ? scenarioMap[session.scenarioId] : null
          const sessionResults = taskResults.filter(r => r.sessionId === session.id && r.taskIndex >= 0)
          const seqResult = taskResults.find(r => r.sessionId === session.id && r.taskIndex === -1)
          const seq = (seqResult?.rating as Record<string, unknown> | undefined)?.seq as number | undefined
          const note = (seqResult?.rating as Record<string, unknown> | undefined)?.note as string | undefined

          return (
            <div key={session.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                <div>
                  <div className="text-sm font-semibold text-white">{sc?.title ?? 'Unknown scenario'}</div>
                  <div className="text-xs mt-0.5" style={{ color: S.dim }}>
                    {formatDate(session.startedAt)}
                    {session.endedAt && <span className="ml-2">{elapsed(session.startedAt, session.endedAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {seq !== undefined && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: seq >= 5 ? 'rgba(5,150,105,0.15)' : 'rgba(217,119,6,0.15)', color: seq >= 5 ? '#34d399' : '#fbbf24' }}>
                      SEQ {seq}/7
                    </span>
                  )}
                  {session.endedAt
                    ? <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(5,150,105,0.1)', color: '#34d399' }}>Done</span>
                    : <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>Dropped</span>}
                </div>
              </div>

              {sc && sc.tasks.length > 0 && sessionResults.length > 0 && (
                <div className="divide-y" style={{ borderColor: S.border }}>
                  {sc.tasks.map((task, idx) => {
                    const result = sessionResults.find(r => r.taskIndex === idx)
                    const timeMs = (result?.rating as Record<string, unknown> | undefined)?.timeMs as number | undefined
                    const clicks = (result?.rating as Record<string, unknown> | undefined)?.clickCount as number | undefined

                    return (
                      <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ background: result?.completed ? '#059669' : result ? '#dc2626' : S.border }}>
                          {idx + 1}
                        </span>
                        <span className="text-xs flex-1 truncate" style={{ color: '#e0e7ff' }}>{task.title}</span>
                        {timeMs && <span className="text-[10px] flex-shrink-0" style={{ color: S.muted }}>{fmtMs(timeMs)}</span>}
                        {clicks != null && <span className="text-[10px] flex-shrink-0" style={{ color: S.muted }}>{clicks} clicks</span>}
                        {result
                          ? <span className="text-[10px] px-1.5 rounded-full flex-shrink-0"
                              style={{ background: result.completed ? 'rgba(5,150,105,0.15)' : 'rgba(220,38,38,0.15)', color: result.completed ? '#34d399' : '#f87171' }}>
                              {result.completed ? '✓ Done' : '✗ Stuck'}
                            </span>
                          : <span className="text-[10px] flex-shrink-0" style={{ color: S.dim }}>—</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              {note && (
                <div className="px-4 py-3 border-t" style={{ borderColor: S.border }}>
                  <p className="text-xs italic" style={{ color: S.muted }}>"{note}"</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Metrics tab ─────────────────────────────────────────────────────────────────

function MetricsTab({ sessions, scenarios, taskResults }: {
  sessions: Session[]
  scenarios: Scenario[]
  taskResults: TaskResult[]
}) {
  const total = sessions.length
  if (total === 0) return <Empty label="No sessions to compute metrics." />

  const completedSessions = sessions.filter(s => s.endedAt)
  const avgDurationMs = completedSessions.length
    ? completedSessions.reduce((acc, s) => acc + (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()), 0) / completedSessions.length
    : null
  const seqResults = taskResults.filter(r => r.taskIndex === -1 && (r.rating as Record<string, unknown>)?.seq !== undefined)
  const avgSeq = seqResults.length
    ? (seqResults.reduce((a, r) => a + ((r.rating as Record<string, unknown>).seq as number), 0) / seqResults.length).toFixed(1)
    : null

  function fmtMs(ms: number | null): string {
    if (ms === null) return '—'
    const s = Math.round(ms / 1000)
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="h-full overflow-y-auto p-5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total sessions', value: total },
          { label: 'Completed', value: completedSessions.length, sub: `${Math.round(completedSessions.length / total * 100)}%` },
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

      {/* Per-scenario breakdown */}
      {scenarios.map(sc => {
        const scSessions = sessions.filter(s => s.scenarioId === sc.id)
        if (scSessions.length === 0) return null
        const scResults = taskResults.filter(r => scSessions.some(s => s.id === r.sessionId) && r.taskIndex >= 0)

        return (
          <div key={sc.id} className="mb-5">
            <h3 className="text-sm font-semibold text-white mb-3">{sc.title}</h3>
            {sc.tasks.length > 0 ? (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: S.card, borderBottom: `1px solid ${S.border}` }}>
                      {['Task', 'Attempts', 'Completed', 'Rate', 'Avg time', 'Avg clicks'].map(h => (
                        <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: S.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sc.tasks.map((task, idx) => {
                      const results = scResults.filter(r => r.taskIndex === idx)
                      const attempted = results.length
                      const completed = results.filter(r => r.completed).length
                      const pct = attempted ? Math.round(completed / attempted * 100) : null
                      const timings = results.map(r => (r.rating as Record<string, unknown>)?.timeMs as number).filter(Boolean)
                      const avgTime = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : null
                      const clicks = results.map(r => (r.rating as Record<string, unknown>)?.clickCount as number).filter(Boolean)
                      const avgClicks = clicks.length ? (clicks.reduce((a, b) => a + b, 0) / clicks.length).toFixed(1) : null

                      return (
                        <tr key={task.id} style={{ borderBottom: `1px solid ${S.border}`, background: idx % 2 === 0 ? S.surface : 'transparent' }}>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                                style={{ background: 'rgba(79,70,229,0.4)' }}>{idx + 1}</span>
                              <span style={{ color: '#e0e7ff' }}>{task.title}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5" style={{ color: S.muted }}>{attempted}</td>
                          <td className="px-3 py-2.5" style={{ color: completed > 0 ? '#34d399' : S.muted }}>{completed}</td>
                          <td className="px-3 py-2.5">
                            {pct !== null ? <PctBadge pct={pct} /> : <span style={{ color: S.dim }}>—</span>}
                          </td>
                          <td className="px-3 py-2.5" style={{ color: S.muted }}>{fmtMs(avgTime)}</td>
                          <td className="px-3 py-2.5" style={{ color: S.muted }}>{avgClicks ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs" style={{ color: S.dim }}>No tasks defined for this scenario.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Comments tab (unchanged) ────────────────────────────────────────────────────

function CommentsTab({ project, comments, sessions, colorFor }: {
  project: Project
  comments: Comment[]
  sessions: Session[]
  colorFor: (id: string) => string
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const layerRef = useRef<ReadOnlyLayerHandle | null>(null)
  const pinsRef = useRef<ReadOnlyPin[]>([])
  const pendingHighlightRef = useRef<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinsVisible, setPinsVisible] = useState(true)

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
    layerRef.current = mountReadOnlyLayer(iframe, { onPinClick: handlePinClick })
    layerRef.current.setPins(pinsRef.current)
    layerRef.current.setVisible(pinsRef.current.length > 0)
    if (pendingHighlightRef.current) {
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
    const url = comment.screen || comment.pageUrl
    setActiveId(comment.id)
    const path = url ? url.replace(/^https?:\/\/[^/]+/, '') || '/' : null
    const curPath = (() => {
      try { return iframeRef.current?.contentWindow?.location?.pathname ?? '' } catch { return '' }
    })()
    const targetPath = path ? path.split('?')[0].replace(/\/+$/, '') || '/' : ''
    const alreadyThere = curPath.replace(/\/+$/, '') === targetPath
    if (alreadyThere || !path) {
      layerRef.current?.highlightPin(comment.id)
    } else {
      pendingHighlightRef.current = comment.id
      iframeRef.current?.contentWindow?.location.assign(path)
    }
  }

  useEffect(() => { pinsRef.current = pins; layerRef.current?.setPins(pins) }, [pins])
  useEffect(() => { layerRef.current?.setVisible(pinsVisible) }, [pinsVisible])
  useEffect(() => {
    const iv = setInterval(() => layerRef.current?.reposition(), 600)
    return () => clearInterval(iv)
  }, [])
  useEffect(() => () => { layerRef.current?.destroy() }, [])

  if (comments.length === 0) return <Empty label="No comments in this view." />

  return (
    <div className="relative h-full overflow-hidden" style={{ background: '#000' }}>
      <iframe ref={iframeRef} src={protoSrc} onLoad={setupLayer} className="w-full h-full border-0" title="Prototype" />
      <aside className="absolute top-0 right-0 bottom-0 w-64 flex flex-col overflow-hidden"
        style={{ background: 'rgba(14,14,24,0.96)', borderLeft: `1px solid ${S.border}` }}>
        <div className="px-4 py-3 border-b flex-shrink-0 flex items-center gap-2" style={{ borderColor: S.border }}>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white">Comments</h3>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>{comments.length} pinned</p>
          </div>
          <button onClick={() => setPinsVisible(v => !v)}
            className="flex-shrink-0 px-2 py-1 rounded-md text-xs transition-colors"
            style={{ background: pinsVisible ? 'rgba(80,70,229,0.2)' : 'rgba(255,255,255,0.05)', color: pinsVisible ? '#818cf8' : S.dim, border: `1px solid ${pinsVisible ? '#4f46e5' : S.border}` }}>
            {pinsVisible ? '● on' : '○ off'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {comments.map((c, i) => {
            const session = sessions.find(s => s.id === c.sessionId)
            const isActive = activeId === c.id
            return (
              <button key={c.id} onClick={() => handleCommentClick(c)}
                className="w-full text-left rounded-xl p-3 transition-all"
                style={{ background: isActive ? 'rgba(80,70,229,0.2)' : 'rgba(17,17,25,0.8)', border: `1px solid ${isActive ? '#4f46e5' : S.border}` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                    style={{ background: colorFor(c.sessionId) }}>{i + 1}</span>
                  <span className="text-[10px] flex-1 truncate font-medium" style={{ color: '#e0e7ff' }}>{session?.testerName ?? 'Unknown'}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: S.dim }}>
                    {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: isActive ? '#c7d2fe' : S.muted }}>{c.text}</p>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}

// ── Shared helpers ──────────────────────────────────────────────────────────────

function PctBadge({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171'
  const bg = pct >= 70 ? 'rgba(5,150,105,0.15)' : pct >= 40 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)'
  return <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>{pct}%</span>
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: S.dim }}>{label}</p>
    </div>
  )
}
