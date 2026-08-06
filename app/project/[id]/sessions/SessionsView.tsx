'use client'

import { useState } from 'react'
import type { Session, Scenario, Comment, TaskResult, PathEvent } from '@/lib/types'
import Link from 'next/link'

// ─── Palette + helpers ────────────────────────────────────────────────────────

const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }
const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 > 0 ? ` ${s % 60}s` : ''}`.trim()
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function elapsed(start: string, end: string): string {
  return fmtDuration(new Date(end).getTime() - new Date(start).getTime())
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

type TimelineEntry =
  | { kind: 'event'; ev: PathEvent }
  | { kind: 'comment'; text: string; ts: string }

function buildTimeline(path: PathEvent[], comments: Comment[]): TimelineEntry[] {
  const entries: TimelineEntry[] = path.map(ev => ({ kind: 'event' as const, ev }))
  for (const c of comments) {
    entries.push({ kind: 'comment', text: c.text, ts: c.createdAt })
  }
  return entries.sort((a, b) => {
    const ta = a.kind === 'event' ? a.ev.timestamp : a.ts
    const tb = b.kind === 'event' ? b.ev.timestamp : b.ts
    return ta.localeCompare(tb)
  })
}

function EventIcon({ type }: { type: PathEvent['type'] }) {
  const icons: Record<string, string> = {
    navigation: '📄', click: '👆', task_start: '▶', task_complete: '✅',
  }
  return <span className="text-sm flex-shrink-0">{icons[type] ?? '•'}</span>
}

// ─── Session detail ───────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'timeline' | 'comments' | 'metrics'

function SessionDetail({
  session, scenario, comments, taskResults, onClose,
}: {
  session: Session; scenario: Scenario | null
  comments: Comment[]; taskResults: TaskResult[]; onClose: () => void
}) {
  const [tab, setTab] = useState<DetailTab>('overview')

  const sessionComments = comments.filter(c => c.sessionId === session.id)
  const sessionTasks    = taskResults.filter(tr => tr.sessionId === session.id && tr.taskIndex >= 0)
  const seqResult       = taskResults.find(tr => tr.sessionId === session.id && tr.taskIndex === -1)
  const seqScore        = seqResult ? (seqResult.rating as Record<string, unknown>).seq as number | undefined : undefined
  const seqNote         = seqResult ? (seqResult.rating as Record<string, unknown>).note as string | undefined : undefined

  const duration = session.endedAt
    ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
    : null

  const clicks    = session.path.filter(e => e.type === 'click').length
  const navs      = session.path.filter(e => e.type === 'navigation').length
  const completedTasks = sessionTasks.filter(t => t.completed).length
  const timeline  = buildTimeline(session.path, sessionComments)

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview',  label: 'Overview'  },
    { id: 'timeline',  label: 'Timeline'  },
    { id: 'comments',  label: `Comments${sessionComments.length ? ` (${sessionComments.length})` : ''}` },
    { id: 'metrics',   label: 'Metrics'   },
  ]

  return (
    <div className="flex flex-col h-full" style={{ background: S.card, borderLeft: `1px solid ${S.border}` }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: S.border }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white truncate">{session.testerName}</span>
            {session.type === 'bot' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>AI</span>
            )}
          </div>
          {scenario && (
            <div className="text-xs px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(80,70,229,0.12)', color: '#818cf8' }}>
              {scenario.title}
            </div>
          )}
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-lg leading-none transition-colors hover:text-white" style={{ color: S.muted }}>✕</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4" style={{ borderColor: S.border }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px"
            style={{ color: tab === t.id ? '#818cf8' : S.muted, borderColor: tab === t.id ? '#818cf8' : 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Duration', value: duration ? fmtDuration(duration) : 'ongoing' },
                { label: 'Tasks done', value: `${completedTasks}/${sessionTasks.length}` },
                { label: 'Clicks', value: String(clicks) },
                { label: 'SEQ score', value: seqScore !== undefined ? `${seqScore}/7` : '—' },
              ].map(m => (
                <div key={m.label} className="px-3 py-2.5 rounded-xl" style={{ background: '#0c0c14', border: `1px solid ${S.border}` }}>
                  <div className="text-base font-bold text-white tabular-nums">{m.value}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: S.dim }}>{m.label}</div>
                </div>
              ))}
            </div>

            {seqNote && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: '#0c0c14', border: `1px solid ${S.border}` }}>
                <p className="text-[10px] mb-1" style={{ color: S.dim }}>Session note</p>
                <p className="text-xs text-white">{seqNote}</p>
              </div>
            )}

            {/* Path summary */}
            <div className="px-3 py-2.5 rounded-xl" style={{ background: '#0c0c14', border: `1px solid ${S.border}` }}>
              <p className="text-[10px] mb-1.5" style={{ color: S.dim }}>Event summary</p>
              <div className="flex items-center gap-3 text-xs">
                <span style={{ color: '#94a3b8' }}>{navs} navigations</span>
                <span style={{ color: S.dim }}>·</span>
                <span style={{ color: '#94a3b8' }}>{clicks} clicks</span>
                <span style={{ color: S.dim }}>·</span>
                <span style={{ color: '#94a3b8' }}>{sessionComments.length} comment{sessionComments.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="space-y-1">
            {timeline.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: S.dim }}>No events recorded</p>
            ) : timeline.map((entry, i) => (
              <div key={i} className="flex gap-2.5 py-1.5">
                {entry.kind === 'event' ? (
                  <>
                    <EventIcon type={entry.ev.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs text-white truncate">{entry.ev.label || entry.ev.selector || entry.ev.url || entry.ev.type}</span>
                      </div>
                      <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: S.dim }}>
                        <span>{entry.ev.type}</span>
                        {entry.ev.url && <span className="truncate max-w-[140px]">{entry.ev.url.replace(/.*\//, '')}</span>}
                        <span className="ml-auto flex-shrink-0">{fmtTime(entry.ev.timestamp)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-shrink-0">📌</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: '#fbbf24' }}>{entry.text}</p>
                      <p className="text-[10px] mt-0.5 text-right" style={{ color: S.dim }}>{fmtTime(entry.ts)}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'comments' && (
          <div className="space-y-2">
            {sessionComments.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: S.dim }}>No comments in this session</p>
            ) : sessionComments.map((c, i) => (
              <div key={i} className="px-3 py-2.5 rounded-xl" style={{ background: '#0c0c14', border: `1px solid ${S.border}` }}>
                <p className="text-xs text-white">{c.text}</p>
                {c.selector && <p className="text-[10px] mt-1 font-mono truncate" style={{ color: S.dim }}>{c.selector}</p>}
                <p className="text-[10px] mt-1" style={{ color: S.dim }}>{fmtDate(c.createdAt)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'metrics' && (
          <div className="space-y-2">
            {sessionTasks.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: S.dim }}>No task metrics recorded</p>
            ) : sessionTasks.map((tr, i) => {
              const taskTitle = scenario?.tasks[tr.taskIndex]?.title ?? `Task ${tr.taskIndex + 1}`
              const r = tr.rating as Record<string, unknown>
              return (
                <div key={i} className="px-3 py-2.5 rounded-xl" style={{ background: '#0c0c14', border: `1px solid ${S.border}` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-white truncate">{taskTitle}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2"
                      style={{ background: tr.completed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: tr.completed ? '#4ade80' : '#f87171' }}>
                      {tr.completed ? 'done' : 'failed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: S.muted }}>
                    {r.timeMs !== undefined && <span>{fmtDuration(Number(r.timeMs))}</span>}
                    {(r.clicks !== undefined || r.clickCount !== undefined) && <span>{Number(r.clicks ?? r.clickCount)} clicks</span>}
                    {r.notes !== undefined && <span className="truncate">{String(r.notes)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── UserRow ──────────────────────────────────────────────────────────────────

interface UserGroup {
  name: string
  sessions: Session[]
  colorIndex: number
}

function UserRow({
  group, scenarios, comments, taskResults, selectedSessionId, onSelectSession,
}: {
  group: UserGroup; scenarios: Scenario[]; comments: Comment[]; taskResults: TaskResult[]
  selectedSessionId: string | null; onSelectSession: (s: Session) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const scenarioMap = Object.fromEntries(scenarios.map(s => [s.id, s]))
  const totalComments = comments.filter(c => group.sessions.some(s => s.id === c.sessionId)).length
  const completed = group.sessions.filter(s => s.endedAt).length
  const lastDate = group.sessions.map(s => s.startedAt).sort().pop()
  const isBot = group.sessions.some(s => s.type === 'bot')

  return (
    <div>
      {/* User row */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer border-b transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: S.border }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: USER_COLORS[group.colorIndex % USER_COLORS.length] }}>
            {group.name.charAt(0).toUpperCase()}
          </span>
          {isBot && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px]"
              style={{ background: '#1c1c2b', color: '#a78bfa' }}>🤖</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">{group.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: S.muted }}>{group.sessions.length} scenario{group.sessions.length !== 1 ? 's' : ''}</span>
            <span style={{ color: S.dim }}>·</span>
            <span className="text-xs" style={{ color: S.muted }}>{completed}/{group.sessions.length} done</span>
            {totalComments > 0 && (
              <>
                <span style={{ color: S.dim }}>·</span>
                <span className="text-xs" style={{ color: '#a5b4fc' }}>📌 {totalComments}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {lastDate && <span className="text-xs" style={{ color: S.dim }}>{fmtDate(lastDate)}</span>}
          <span className="text-xs transition-transform" style={{ color: S.dim, transform: expanded ? 'rotate(90deg)' : '' }}>▶</span>
        </div>
      </div>

      {/* Expanded: scenario rows */}
      {expanded && (
        <div className="border-b" style={{ borderColor: S.border, background: '#0c0c14' }}>
          {group.sessions.map((session) => {
            const scenario = session.scenarioId ? scenarioMap[session.scenarioId] : null
            const sessionTasks = taskResults.filter(tr => tr.sessionId === session.id && tr.taskIndex >= 0)
            const done = sessionTasks.filter(t => t.completed).length
            const seqTR = taskResults.find(tr => tr.sessionId === session.id && tr.taskIndex === -1)
            const seq = seqTR ? (seqTR.rating as Record<string, unknown>).seq as number | undefined : undefined
            const clicks = session.path.filter(e => e.type === 'click').length
            const duration = session.endedAt
              ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
              : null
            const isSelected = session.id === selectedSessionId

            return (
              <div
                key={session.id}
                className="flex items-center gap-4 pl-16 pr-5 py-3 cursor-pointer transition-colors"
                style={{
                  background: isSelected ? 'rgba(80,70,229,0.08)' : 'transparent',
                  borderLeft: isSelected ? '2px solid #5046e5' : '2px solid transparent',
                }}
                onClick={() => onSelectSession(session)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-white">{scenario?.title ?? 'Unnamed scenario'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: S.dim }}>
                      {done}/{sessionTasks.length || '?'} tasks
                    </span>
                    {duration && <><span style={{ color: S.dim }}>·</span><span className="text-[10px]" style={{ color: S.dim }}>{fmtDuration(duration)}</span></>}
                    {clicks > 0 && <><span style={{ color: S.dim }}>·</span><span className="text-[10px]" style={{ color: S.dim }}>{clicks} clicks</span></>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {seq !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8' }}>
                      SEQ {seq}/7
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: session.endedAt ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.1)', color: session.endedAt ? '#4ade80' : '#fbbf24' }}>
                    {session.endedAt ? 'done' : 'live'}
                  </span>
                  <span className="text-[10px]" style={{ color: S.dim }}>→</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── SessionsView ─────────────────────────────────────────────────────────────

export default function SessionsView({
  projectId,
  sessions,
  scenarios,
  comments,
  taskResults,
}: {
  projectId: string
  sessions: Session[]
  scenarios: Scenario[]
  comments: Comment[]
  taskResults: TaskResult[]
}) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  // Group sessions by testerName (= one "user session")
  const userGroups: UserGroup[] = []
  const seen = new Map<string, number>()
  for (const s of sessions) {
    if (!seen.has(s.testerName)) {
      seen.set(s.testerName, userGroups.length)
      userGroups.push({ name: s.testerName, sessions: [], colorIndex: userGroups.length })
    }
    userGroups[seen.get(s.testerName)!].sessions.push(s)
  }

  const scenarioMap = Object.fromEntries(scenarios.map(s => [s.id, s]))
  const selectedScenario = selectedSession?.scenarioId ? scenarioMap[selectedSession.scenarioId] ?? null : null

  return (
    <div className="flex h-full" style={{ background: S.bg }}>
      {/* Session list */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* List header */}
        <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: S.border, background: S.surface }}>
          <div>
            <h1 className="text-base font-bold text-white">Sessions</h1>
            <p className="text-xs mt-0.5" style={{ color: S.muted }}>
              {userGroups.length} tester{userGroups.length !== 1 ? 's' : ''} · {sessions.length} scenario run{sessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href={`/t/${projectId}`}
            target="_blank"
            className="text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: '#5046e5' }}
          >
            ▶ Start session
          </Link>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto">
          {userGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#3a3a52" strokeWidth="1.5"/>
                  <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#3a3a52" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p className="font-medium text-white">No sessions yet</p>
                <p className="text-sm mt-1" style={{ color: S.muted }}>Share the test link to start collecting sessions.</p>
              </div>
            </div>
          ) : (
            userGroups.map((group, i) => (
              <UserRow
                key={group.name}
                group={group}
                scenarios={scenarios}
                comments={comments}
                taskResults={taskResults}
                selectedSessionId={selectedSession?.id ?? null}
                onSelectSession={setSelectedSession}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedSession && (
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden">
          <SessionDetail
            session={selectedSession}
            scenario={selectedScenario}
            comments={comments}
            taskResults={taskResults}
            onClose={() => setSelectedSession(null)}
          />
        </div>
      )}
    </div>
  )
}
