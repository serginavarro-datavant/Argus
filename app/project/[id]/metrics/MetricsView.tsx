'use client'

import { useState, useMemo } from 'react'
import type { Session, Scenario, TaskResult } from '@/lib/types'
import { formatDate, elapsed } from '@/lib/utils'

const USER_COLORS = ['#4f46e5', '#059669', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d']
const S = { bg: '#0b0b13', surface: '#0e0e18', card: '#111119', border: '#1c1c2b', muted: '#5c5c78', dim: '#3a3a52' }

interface Props {
  sessions: Session[]
  scenarios: Scenario[]
  taskResults: TaskResult[]
}

export default function MetricsView({ sessions, scenarios, taskResults }: Props) {
  const [scenarioFilter, setScenarioFilter] = useState<string>('all')

  const visibleSessions = useMemo(() =>
    scenarioFilter === 'all' ? sessions : sessions.filter(s => s.scenarioId === scenarioFilter),
    [sessions, scenarioFilter],
  )

  const scenario = scenarioFilter !== 'all' ? (scenarios.find(s => s.id === scenarioFilter) ?? null) : null

  const filteredTaskResults = useMemo(() => {
    const ids = new Set(visibleSessions.map(s => s.id))
    return taskResults.filter(r => ids.has(r.sessionId))
  }, [visibleSessions, taskResults])

  const total = visibleSessions.length
  const completedSessions = visibleSessions.filter(s => s.endedAt)
  const avgDurationMs = completedSessions.length
    ? completedSessions.reduce((acc, s) => acc + (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()), 0) / completedSessions.length
    : null

  const seqResults = filteredTaskResults.filter(r => r.taskIndex === -1 && (r.rating as Record<string, unknown>)?.seq !== undefined)
  const avgSeq = seqResults.length
    ? (seqResults.reduce((a, r) => a + ((r.rating as Record<string, unknown>).seq as number), 0) / seqResults.length).toFixed(1)
    : null

  function fmtMs(ms: number | null): string {
    if (ms === null) return '—'
    const s = Math.round(ms / 1000)
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="p-8" style={{ background: S.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Metrics</h1>
          <p className="text-sm mt-0.5" style={{ color: S.muted }}>Session performance and task-level stats</p>
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
        <div className="flex items-center justify-center py-32">
          <p className="text-sm" style={{ color: S.dim }}>No sessions to compute metrics.</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
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
              <h2 className="text-sm font-semibold text-white mb-4">Task breakdown — {scenario.title}</h2>
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
                      const results = filteredTaskResults.filter(r => r.taskIndex === i)
                      const attempted = results.length
                      const completed = results.filter(r => r.completed).length
                      const pct = attempted ? Math.round(completed / attempted * 100) : null
                      const timings = results.map(r => (r.rating as Record<string, unknown>)?.timeMs as number).filter(Boolean)
                      const avgTime = timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : null
                      const fastest = timings.length ? Math.min(...timings) : null
                      const clicks = results.map(r => (r.rating as Record<string, unknown>)?.clickCount as number).filter(Boolean)
                      const avgClicks = clicks.length ? (clicks.reduce((a, b) => a + b, 0) / clicks.length).toFixed(1) : null
                      return (
                        <tr key={task.id} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.surface : 'transparent' }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                                style={{ background: 'rgba(80,70,229,0.4)' }}>
                                {i + 1}
                              </span>
                              <span style={{ color: '#e0e7ff' }}>{task.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3" style={{ color: S.muted }}>{attempted || 0}</td>
                          <td className="px-4 py-3"><span style={{ color: completed > 0 ? '#34d399' : S.muted }}>{completed}</span></td>
                          <td className="px-4 py-3">
                            {pct !== null ? <PctBadge pct={pct} /> : <span style={{ color: S.dim }}>—</span>}
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
            <h2 className="text-sm font-semibold text-white mb-4">Per-user summary</h2>
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
                  {visibleSessions.map((s, i) => {
                    const userResults = filteredTaskResults.filter(r => r.sessionId === s.id && r.taskIndex >= 0)
                    const tasksDone = userResults.filter(r => r.completed).length
                    const seqR = filteredTaskResults.find(r => r.sessionId === s.id && r.taskIndex === -1)
                    const seq = (seqR?.rating as Record<string, unknown> | undefined)?.seq as number | undefined
                    return (
                      <tr key={s.id} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.surface : 'transparent' }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                              style={{ background: USER_COLORS[i % USER_COLORS.length] }}>
                              {s.testerName.charAt(0).toUpperCase()}
                            </span>
                            <span style={{ color: '#e0e7ff' }}>{s.testerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: S.muted }}>{formatDate(s.startedAt)}</td>
                        <td className="px-4 py-3" style={{ color: S.muted }}>
                          {s.endedAt ? elapsed(s.startedAt, s.endedAt) : <span style={{ color: '#fbbf24' }}>ongoing</span>}
                        </td>
                        <td className="px-4 py-3" style={{ color: userResults.length > 0 ? (tasksDone > 0 ? '#34d399' : S.muted) : S.dim }}>
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
        </>
      )}
    </div>
  )
}

function PctBadge({ pct }: { pct: number }) {
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#fbbf24' : '#f87171'
  const bg = pct >= 70 ? 'rgba(5,150,105,0.15)' : pct >= 40 ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)'
  return (
    <span className="px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>{pct}%</span>
  )
}
