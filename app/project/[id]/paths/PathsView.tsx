'use client'

import { useState, useMemo } from 'react'
import type { Session, Scenario, TaskResult } from '@/lib/types'

const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

interface Props {
  sessions: Session[]
  scenarios: Scenario[]
  taskResults: TaskResult[]
}

export default function PathsView({ sessions, scenarios, taskResults }: Props) {
  const [scenarioFilter, setScenarioFilter] = useState<string>('all')

  const visibleSessions = useMemo(() =>
    scenarioFilter === 'all' ? sessions : sessions.filter(s => s.scenarioId === scenarioFilter),
    [sessions, scenarioFilter],
  )

  const activeScenario = scenarioFilter !== 'all' ? (scenarios.find(s => s.id === scenarioFilter) ?? null) : null

  const filteredTaskResults = useMemo(() => {
    const ids = new Set(visibleSessions.map(s => s.id))
    return taskResults.filter(r => ids.has(r.sessionId))
  }, [visibleSessions, taskResults])

  const urlCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>()
    for (const s of visibleSessions) {
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
      .slice(0, 20)
  }, [visibleSessions])

  const total = visibleSessions.length

  return (
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Paths</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>Navigation flow and task completion funnel</p>
        </div>
        {scenarios.length > 0 && (
          <select
            value={scenarioFilter}
            onChange={e => setScenarioFilter(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: S.card, border: `1px solid ${S.border}`, color: '#fff' }}
          >
            <option value="all">All sessions ({sessions.length})</option>
            {scenarios.map(sc => (
              <option key={sc.id} value={sc.id}>
                {sc.title} ({sessions.filter(s => s.scenarioId === sc.id).length})
              </option>
            ))}
          </select>
        )}
      </div>

      {total === 0 ? (
        <Empty label="No sessions to show paths." />
      ) : (
        <>
          {/* Task funnel */}
          {activeScenario && activeScenario.tasks.length > 0 && (
            <section className="mb-10">
              <h2 className="text-sm font-semibold text-white mb-1">{activeScenario.title}</h2>
              <p className="text-xs mb-5" style={{ color: S.muted }}>
                Task completion funnel — {total} session{total !== 1 ? 's' : ''}
              </p>
              <div className="space-y-3">
                {activeScenario.tasks.map((task, i) => {
                  const results = filteredTaskResults.filter(r => r.taskIndex === i)
                  const completed = results.filter(r => r.completed).length
                  const attempted = results.length
                  const pct = attempted ? Math.round(completed / attempted * 100) : (total > 0 ? 0 : null)
                  const prevResults = i > 0 ? filteredTaskResults.filter(r => r.taskIndex === i - 1) : null
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
                        <div className="flex flex-wrap gap-1 mt-2">
                          {visibleSessions.map((s, si) => {
                            const r = filteredTaskResults.find(r => r.sessionId === s.id && r.taskIndex === i)
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

          {/* Page visits */}
          {urlCounts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-white mb-1">Page visits</h2>
              <p className="text-xs mb-4" style={{ color: S.muted }}>
                Unique screens visited — {total} session{total !== 1 ? 's' : ''}
              </p>
              <div className="space-y-2 max-w-2xl">
                {urlCounts.map(({ url, count }, i) => (
                  <div key={url} className="flex items-center gap-4 rounded-xl p-3" style={{ background: S.card, border: `1px solid ${S.border}` }}>
                    <span className="text-xs w-5 text-center flex-shrink-0" style={{ color: S.dim }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-mono truncate" style={{ color: '#94a3b8' }}>{url}</span>
                        <span className="text-xs ml-3 flex-shrink-0 font-semibold" style={{ color: '#a5b4fc' }}>{count}/{total}</span>
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

          {!activeScenario && urlCounts.length === 0 && (
            <Empty label="No navigation data recorded yet." />
          )}
        </>
      )}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-32">
      <p className="text-sm" style={{ color: S.dim }}>{label}</p>
    </div>
  )
}
